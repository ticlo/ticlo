import type {Flow, Root} from './Flow.ts';
import {Namespace} from './Namespace.ts';
import type {NamespaceMetadata} from './Storage.ts';
import {namespacePrefix, validateNamespace} from '../util/NamespaceMetadata.ts';
import {validFlowEntry} from '../util/FlowStoragePath.ts';
import {matchEditPath} from '../policy/EditPolicy.ts';
import type {DataMap} from '../util/DataTypes.ts';

export type StartOptions = Record<string, {flows?: string[]}>;
export interface FlowRef {
  namespace: string;
  kind: 'flow' | 'library';
  name: string;
}
export interface UnloadOptions {
  discardChanges?: boolean;
}

export function flowRefFromPath(path: string): FlowRef {
  let namespace = '#root';
  if (path.startsWith('+')) {
    const dot = path.indexOf('.');
    if (dot < 2) throw new Error('Invalid flow path');
    namespace = path.slice(1, dot);
    if (namespace === '#root') throw new Error('Root flow paths must be unqualified');
    path = path.slice(dot + 1);
  }
  return {
    namespace,
    kind: path.startsWith(':') ? 'library' : 'flow',
    name: path.startsWith(':') ? path.slice(1) : path,
  };
}

/** Per-run state. Nothing in this class's catalog or loading sets is serialized. */
export class FlowRuntime {
  started = false;
  private generation = 0;
  private readonly namespaceVersions = new Map<string, number>();
  private readonly metadata = new Map<string, NamespaceMetadata>();
  private readonly pending = new Map<string, {promise: Promise<Flow>; cancelled: boolean}>();
  private readonly suppressed = new Set<string>();
  private readonly loaded = new Map<string, {ref: FlowRef; flow: Flow}>();

  constructor(private readonly root: Root) {}

  private namespace(name: string) {
    validateNamespace(name);
    return Namespace.getNameSpace(`+${name}`, this.root);
  }

  key(ref: FlowRef) {
    const prefix = namespacePrefix(ref.namespace);
    if (ref.kind !== 'flow' && ref.kind !== 'library') throw new Error('Invalid flow kind');
    const names = ref.kind === 'library' ? [ref.name] : ref.name.split('.');
    if (!names.every(validFlowEntry)) throw new Error(`Invalid flow name: ${ref.name}`);
    return `${prefix}${ref.kind === 'library' ? ':' : ''}${ref.name}`;
  }

  async start(options: StartOptions = {}) {
    if (this.started) throw new Error('The runtime has already started; call stop() first');
    this.started = true;
    const generation = this.generation;
    try {
      const selected = Object.keys(options).length
        ? options
        : ((await this.root._storage?.getDefaultStartOptions?.()) ?? {'#root': {}});
      this.checkGeneration(generation);
      // Discover every dependency before running anything, including cyclic graphs.
      await this.activate(Object.keys(selected), generation);
      for (const [name, config] of Object.entries(selected)) {
        await this.loadSelected(name, config.flows ?? [], generation);
      }
      this.checkGeneration(generation);
    } catch (error) {
      if (generation === this.generation) await this.stop({discardChanges: true});
      throw error;
    }
  }

  private checkGeneration(generation: number) {
    if (generation !== this.generation || this.root._destroyed) throw new Error('Runtime operation cancelled');
  }

  private async activate(names: string[], generation: number) {
    const discovered = new Map<string, NamespaceMetadata>();
    const versions = new Map<string, number>();
    const check = () => {
      this.checkGeneration(generation);
      for (const [name, version] of versions) {
        if (this.namespaceVersions.get(name) !== version) throw new Error(`Namespace activation cancelled: ${name}`);
      }
    };
    const visit = async (name: string) => {
      validateNamespace(name);
      if (!versions.has(name)) versions.set(name, this.namespaceVersions.get(name));
      if (discovered.has(name) || this.metadata.has(name)) return;
      const data = (await this.root._storage?.getNamespaceMetadata?.(name)) ?? {};
      check();
      discovered.set(name, data);
      for (const dependency of data.dependencies ?? []) await visit(dependency);
    };
    for (const name of names) await visit(name);
    check();
    for (const [name, data] of discovered) {
      this.metadata.set(name, data);
      const ns = this.namespace(name);
      ns._enabled = true;
      if (name !== '#root') this.root.addFlowFolder(ns.ns, {});
    }
    try {
      for (const [name, data] of discovered) {
        for (const library of data.serviceLibraries ?? []) {
          await this.loadFlow({namespace: name, kind: 'library', name: library});
          check();
        }
        // Restore subscriptions created while this namespace was inactive.
        for (const library of Object.keys(this.namespace(name)._libs)) {
          if (this.namespace(name)._libs[library].hasRuntimeListeners()) this.loadLibraryOnDemand(name, library);
        }
      }
    } catch (error) {
      for (const [name, data] of discovered) {
        if (
          generation === this.generation &&
          this.metadata.get(name) === data &&
          this.namespaceVersions.get(name) === versions.get(name)
        ) {
          await this.disableNamespace(name, {cascade: true, discardChanges: true});
        }
      }
      throw error;
    }
  }

  private async loadSelected(namespace: string, patterns: string[], generation: number) {
    if (!patterns.length) return;
    if (!this.root._storage?.listFlows) throw new Error('Storage does not support listing flows');
    const folders: string[] = [];
    const version = this.namespaceVersions.get(namespace);
    const names = await this.root._storage.listFlows(namespace, folders);
    this.checkGeneration(generation);
    if (version !== this.namespaceVersions.get(namespace))
      throw new Error(`Namespace selection cancelled: ${namespace}`);
    for (const folder of folders) {
      const path = `${namespacePrefix(namespace)}${folder}`;
      if (!this.root.queryValue(path)) this.root.addFlowFolder(path, {}, true);
    }
    this.checkGeneration(generation);
    for (const pattern of patterns) {
      if (!/[?*]/.test(pattern) && !names.includes(pattern)) throw new Error(`Missing flow: ${namespace}/${pattern}`);
    }
    for (const name of names) {
      if (patterns.some((pattern) => matchEditPath(pattern, name))) {
        await this.loadFlow({namespace, kind: 'flow', name});
        this.checkGeneration(generation);
        if (version !== this.namespaceVersions.get(namespace))
          throw new Error(`Namespace selection cancelled: ${namespace}`);
      }
    }
  }

  async enableNamespace(name: string, options: {flows?: string[]} = {}) {
    this.started = true;
    const generation = this.generation;
    await this.activate([name], generation);
    await this.loadSelected(name, options.flows ?? [], generation);
  }

  loadLibraryOnDemand(namespace: string, name: string) {
    const ref: FlowRef = {namespace, kind: 'library', name};
    const key = this.key(ref);
    if (this.suppressed.has(key) || !this.namespace(namespace)._enabled) return;
    const generation = this.generation;
    const version = this.namespaceVersions.get(namespace);
    this.loadFlow(ref).catch((error) => {
      if (
        generation !== this.generation ||
        version !== this.namespaceVersions.get(namespace) ||
        !this.namespace(namespace)._enabled
      )
        return;
      if (this.getFlowState(ref) !== 'unloaded') return;
      // Keep a failed lazy load from retrying on every resolver pass.
      this.suppressed.add(key);
      this.root.updateValue('@load-error', String(error));
    });
  }

  loadFlow(ref: FlowRef): Promise<Flow> {
    const key = this.key(ref);
    if (!this.namespace(ref.namespace)._enabled)
      return Promise.reject(new Error(`Namespace is not enabled: ${ref.namespace}`));
    const existing = this.loaded.get(key)?.flow;
    if (existing && !existing._destroyed) return Promise.resolve(existing);
    if (this.pending.has(key)) return this.pending.get(key).promise;
    this.suppressed.delete(key);
    const operation = {promise: undefined as Promise<Flow>, cancelled: false};
    const generation = this.generation;
    operation.promise = Promise.resolve()
      .then(async () => {
        const storage = this.root._storage;
        const ns = this.namespace(ref.namespace);
        const data =
          ref.kind === 'library'
            ? await storage?.loadLib(ref.namespace === '#root' ? '' : ns.ns, ref.name)
            : await storage?.loadFlow(key);
        this.checkGeneration(generation);
        if (operation.cancelled || !ns._enabled) throw new Error(`Flow load cancelled: ${key}`);
        if (!data) throw new Error(`Missing ${ref.kind}: ${ref.namespace}/${ref.name}`);
        let flow: Flow;
        if (ref.kind === 'library') {
          const lib = ns.getLib(ref.name, false);
          lib.setAvailable(false);
          flow = this.root.addFlowLib(ns.ns, ref.name);
          if (!flow) throw new Error(`Conflicting library: ${key}`);
          lib.flow = flow;
          flow.load(
            data,
            null,
            async (changed) => {
              const saved = changed.save();
              await storage.saveLib(ref.namespace === '#root' ? '' : ns.ns, ref.name, saved);
              return saved;
            },
            undefined,
            ns.ns,
            lib
          );
          lib.setAvailable(!flow._disabled);
        } else {
          flow = this.root.addFlow(key, data, undefined, true, true);
          if (!flow) throw new Error(`Conflicting flow: ${key}`);
        }
        this.loaded.set(key, {ref: {...ref}, flow});
        return flow;
      })
      .finally(() => {
        if (this.pending.get(key) === operation) this.pending.delete(key);
      });
    this.pending.set(key, operation);
    return operation.promise;
  }

  trackFlow(ref: FlowRef, flow: Flow) {
    this.loaded.set(this.key(ref), {ref, flow});
  }

  async listFlows(namespace: string) {
    validateNamespace(namespace);
    return ((await this.root._storage?.listFlows?.(namespace)) ?? []).map((name) => ({
      name,
      state: this.getFlowState({namespace, kind: 'flow', name}),
    }));
  }

  async setServiceLibrary(namespace: string, name: string, service: boolean) {
    this.key({namespace, name, kind: 'library'});
    const storage = this.root._storage;
    if (!storage?.saveNamespaceMetadata || storage.persistent === false)
      throw new Error('Storage does not support persistence');
    const metadata = await storage.getNamespaceMetadata(namespace);
    const services = new Set(metadata.serviceLibraries);
    if (service) services.add(name);
    else services.delete(name);
    const updated = {...metadata, serviceLibraries: [...services]};
    await storage.saveNamespaceMetadata(namespace, updated);
    if (this.namespace(namespace)._enabled) {
      this.metadata.set(namespace, updated);
      if (service) await this.loadFlow({namespace, name, kind: 'library'});
    }
  }

  private assertClean(flow: Flow, options: UnloadOptions) {
    if (!flow._destroyed && !options.discardChanges && (flow.getValue('@has-change') || flow._history?._tracking)) {
      throw new Error(`Flow has unsaved changes: ${flow.getFullPath()}`);
    }
  }

  async unloadFlow(ref: FlowRef, options: UnloadOptions = {}) {
    const key = this.key(ref);
    const flow = this.loaded.get(key)?.flow;
    if (flow) this.assertClean(flow, options);
    this.suppressed.add(key);
    const pending = this.pending.get(key);
    if (pending) {
      pending.cancelled = true;
      this.pending.delete(key);
    }
    if (ref.kind === 'library') {
      const lib = this.namespace(ref.namespace).getLib(ref.name, false);
      lib.setAvailable(false);
      lib.load({});
      lib._loaded = false;
      lib.flow = undefined;
    }
    if (flow && !flow._destroyed) flow._prop.setValue(undefined);
    this.loaded.delete(key);
  }

  async setEnabled(ref: FlowRef, enabled: boolean, options: {persist?: boolean} = {}) {
    const key = this.key(ref);
    const flow = this.loaded.get(key)?.flow;
    if (!flow || flow._destroyed) throw new Error(`Flow is not loaded: ${key}`);
    if (options.persist) {
      const storage = this.root._storage;
      if (!storage || storage.persistent === false) throw new Error('Storage does not support persistence');
      // Persist only this flag, not unrelated unsaved editor changes.
      const ns = ref.namespace === '#root' ? '' : `+${ref.namespace}`;
      const data = ref.kind === 'library' ? await storage.loadLib(ns, ref.name) : await storage.loadFlow(key);
      if (!data) throw new Error(`Missing flow: ${key}`);
      const saved: DataMap = {...data, '#disabled': !enabled};
      if (ref.kind === 'library') await storage.saveLib(ns, ref.name, saved);
      else await storage.saveFlow(null, saved, key);
      if (flow._destroyed || this.loaded.get(key)?.flow !== flow) return;
      flow._runtimeDisabled = undefined;
      flow.setValue('#disabled', !enabled);
    } else {
      flow._runtimeDisabled = !enabled;
    }
    flow._disabledChanged(flow.getValue('#disabled'));
  }

  getFlowState(ref: FlowRef): 'unloaded' | 'loading' | 'enabled' | 'disabled' {
    const key = this.key(ref);
    if (this.pending.has(key)) return 'loading';
    const flow = this.loaded.get(key)?.flow;
    return !flow || flow._destroyed ? 'unloaded' : flow._disabled ? 'disabled' : 'enabled';
  }

  async disableNamespace(name: string, options: UnloadOptions & {cascade?: boolean} = {}) {
    validateNamespace(name);
    const removed = new Set([name]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [other, data] of this.metadata) {
        if (!removed.has(other) && data.dependencies?.some((dependency) => removed.has(dependency))) {
          if (!options.cascade) throw new Error(`Namespace ${other} depends on ${name}`);
          removed.add(other);
          changed = true;
        }
      }
    }
    for (const {ref, flow} of this.loaded.values()) if (removed.has(ref.namespace)) this.assertClean(flow, options);
    for (const ns of removed) {
      this.namespaceVersions.set(ns, (this.namespaceVersions.get(ns) ?? 0) + 1);
      this.namespace(ns)._enabled = false;
      this.metadata.delete(ns);
    }
    for (const {ref} of [...this.loaded.values()]) if (removed.has(ref.namespace)) await this.unloadFlow(ref, options);
    for (const [key, pending] of this.pending) {
      if ([...removed].some((ns) => key.startsWith(namespacePrefix(ns)) && (ns !== '#root' || !key.startsWith('+')))) {
        pending.cancelled = true;
        this.pending.delete(key);
      }
    }
    for (const key of this.suppressed) {
      if ([...removed].some((ns) => key.startsWith(namespacePrefix(ns)) && (ns !== '#root' || !key.startsWith('+'))))
        this.suppressed.delete(key);
    }
  }

  async stop(options: UnloadOptions = {}) {
    for (const {flow} of this.loaded.values()) this.assertClean(flow, options);
    ++this.generation;
    for (const ns of Object.values(this.root._namespaces)) {
      ns._enabled = false;
      for (const lib of Object.values(ns._libs)) lib.setAvailable(false);
    }
    for (const pending of this.pending.values()) pending.cancelled = true;
    this.pending.clear();
    for (const {ref} of [...this.loaded.values()]) await this.unloadFlow(ref, options);
    this.metadata.clear();
    this.suppressed.clear();
    this.started = false;
  }
}
