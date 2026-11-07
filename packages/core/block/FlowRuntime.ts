import type {Flow, FlowNameSpace, Root} from './Flow.ts';
import {Namespace} from './Namespace.ts';
import type {NamespaceMetadata} from './Storage.ts';
import {namespacePrefix, readNamespaceMetadata, validateNamespace} from '../util/NamespaceMetadata.ts';
import {validFlowEntry} from '../util/FlowStoragePath.ts';
import {matchEditPath} from '../policy/EditPolicy.ts';
import type {DataMap} from '../util/DataTypes.ts';

export type StartOptions = Record<string, {flows?: string[]}>;
export interface FlowRef {
  namespace: string;
  kind: 'flow' | 'library';
  name: string;
}
export interface MainFlowEntry {
  namespace: string;
  name: string;
  state: 'unloaded' | 'loading' | 'enabled' | 'disabled';
  autoLoad: boolean;
  canAutoLoad: boolean;
}
export interface UnloadOptions {
  discardChanges?: boolean;
}

interface PreparedSelection {
  namespace: string;
  version: number;
  folders: string[];
  flows: {ref: FlowRef; data: Promise<DataMap | null>}[];
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
  private readonly roots = new Set<string>();
  private readonly pending = new Map<string, {promise: Promise<Flow>; cancelled: boolean}>();
  private readonly suppressed = new Set<string>();
  private readonly loaded = new Map<string, {ref: FlowRef; flow: Flow}>();
  private readonly rootFlows = new Set<string>();

  constructor(private readonly root: Root) {}

  private namespace(name: string) {
    validateNamespace(name);
    return Namespace.getNameSpace(`+${name}`, this.root);
  }

  key(ref: FlowRef) {
    const prefix = namespacePrefix(ref.namespace);
    if (ref.kind !== 'flow' && ref.kind !== 'library') throw new Error('Invalid flow kind');
    const names = ref.kind === 'library' ? [ref.name] : ref.name.split('.');
    const context = ref.kind === 'flow' && ref.namespace !== '#root' && ref.name === '#context';
    if (!context && !names.every(validFlowEntry)) throw new Error(`Invalid flow name: ${ref.name}`);
    return `${prefix}${ref.kind === 'library' ? ':' : ''}${ref.name}`;
  }

  async start(options: StartOptions = {}) {
    if (this.started) throw new Error('The runtime has already started; call stop() first');
    this.started = true;
    const generation = this.generation;
    try {
      const defaultRoot = !Object.keys(options).length;
      const selected = defaultRoot ? {'#root': {}} : options;
      this.checkGeneration(generation);
      const selections = Object.entries(selected).map(([name, config]) =>
        config.flows === undefined ? null : this.prepareSelected(name, config.flows, generation)
      );
      for (const selection of selections) void selection?.catch(() => {});
      // Discover every dependency before running anything, including cyclic graphs.
      await this.activate(Object.keys(selected), generation);
      for (const [index, [name, config]] of Object.entries(selected).entries()) {
        const patterns =
          config.flows ??
          this.metadata.get(name)?.autoLoadFlows ??
          (defaultRoot && name === '#root' && this.root._storage ? ['**'] : []);
        await this.loadSelected(
          await (selections[index] ?? this.prepareSelected(name, patterns, generation)),
          generation
        );
      }
      this.checkGeneration(generation);
      for (const name of Object.keys(selected)) this.roots.add(name);
    } catch (error) {
      if (generation === this.generation) await this.stop({discardChanges: true});
      throw error;
    }
  }

  private checkGeneration(generation: number) {
    if (generation !== this.generation || this.root._destroyed) throw new Error('Runtime operation cancelled');
  }

  private readFlow(ref: FlowRef): Promise<DataMap | null> {
    const storage = this.root._storage;
    if (!storage) return Promise.resolve(null);
    return ref.kind === 'library'
      ? storage.loadLib(ref.namespace === '#root' ? '' : `+${ref.namespace}`, ref.name)
      : storage.loadFlow(this.key(ref));
  }

  private prefetch(ref: FlowRef): Promise<DataMap | null> {
    const data = this.readFlow(ref);
    void data.catch(() => {});
    return data;
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
    const contexts = [...discovered.keys()]
      .filter((name) => name !== '#root')
      .map((namespace) => {
        const ref: FlowRef = {namespace, kind: 'flow', name: '#context'};
        return {ref, data: this.prefetch(ref)};
      });
    const autoLoadLibraries = [...discovered].flatMap(([namespace, data]) =>
      (data.autoLoadLibraries ?? []).map((name) => {
        const ref: FlowRef = {namespace, kind: 'library', name};
        return {ref, data: this.prefetch(ref)};
      })
    );
    for (const [name, data] of discovered) {
      this.metadata.set(name, data);
      const ns = this.namespace(name);
      ns._enabled = true;
      if (name !== '#root') this.root.addFlowFolder(ns.ns, {});
    }
    try {
      // Contexts replace the namespace's inheritance layer and load before libraries/flows.
      for (const {ref, data} of contexts) {
        await this.loadFlow(ref, data);
        check();
      }
      for (const {ref, data} of autoLoadLibraries) {
        await this.loadFlow(ref, data);
        check();
      }
      for (const [name] of discovered) {
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

  private async prepareSelected(namespace: string, patterns: string[], generation: number): Promise<PreparedSelection> {
    const version = this.namespaceVersions.get(namespace);
    if (!patterns.length) return {namespace, version, folders: [], flows: []};
    if (!this.root._storage?.listFlows) throw new Error('Storage does not support listing flows');
    const folders: string[] = [];
    const names = await this.root._storage.listFlows(namespace, folders);
    this.checkGeneration(generation);
    if (version !== this.namespaceVersions.get(namespace))
      throw new Error(`Namespace selection cancelled: ${namespace}`);
    for (const pattern of patterns) {
      if (!/[?*]/.test(pattern) && !names.includes(pattern)) throw new Error(`Missing flow: ${namespace}/${pattern}`);
    }
    const flows = names
      .filter((name) => patterns.some((pattern) => matchEditPath(pattern, name)))
      .map((name) => {
        const ref: FlowRef = {namespace, kind: 'flow', name};
        return {ref, data: this.prefetch(ref)};
      });
    return {namespace, version, folders, flows};
  }

  private async loadSelected({namespace, version, folders, flows}: PreparedSelection, generation: number) {
    this.checkGeneration(generation);
    if (version !== this.namespaceVersions.get(namespace))
      throw new Error(`Namespace selection cancelled: ${namespace}`);
    for (const folder of folders) {
      const path = `${namespacePrefix(namespace)}${folder}`;
      if (!this.root.queryValue(path)) this.root.addFlowFolder(path, {}, true);
    }
    for (const {ref, data} of flows) {
      const key = this.key(ref);
      const alreadyLoaded = this.loaded.has(key);
      await this.loadFlow(ref, data);
      if (!alreadyLoaded) this.rootFlows.add(key);
      this.checkGeneration(generation);
      if (version !== this.namespaceVersions.get(namespace))
        throw new Error(`Namespace selection cancelled: ${namespace}`);
    }
  }

  async enableNamespace(name: string, options: {flows?: string[]} = {}) {
    this.started = true;
    const generation = this.generation;
    const selection = options.flows === undefined ? null : this.prepareSelected(name, options.flows, generation);
    void selection?.catch(() => {});
    await this.activate([name], generation);
    await this.loadSelected(
      await (selection ?? this.prepareSelected(name, this.metadata.get(name)?.autoLoadFlows ?? [], generation)),
      generation
    );
    this.roots.add(name);
  }

  getNamespaceGraph() {
    return {
      roots: [...this.roots],
      dependencies: Object.fromEntries(
        [...this.metadata].map(([name, data]) => [name, [...(data.dependencies ?? [])]])
      ) as Record<string, string[]>,
    };
  }

  private requiredNamespaces(roots: Iterable<string>, updated?: {name: string; metadata: NamespaceMetadata}) {
    const required = new Set<string>();
    const visit = (name: string) => {
      if (required.has(name)) return;
      required.add(name);
      const data = name === updated?.name ? updated.metadata : this.metadata.get(name);
      for (const dependency of data?.dependencies ?? []) visit(dependency);
    };
    for (const name of roots) visit(name);
    return required;
  }

  async retainNamespaces(roots: string[]) {
    for (const name of roots) {
      if (!this.roots.has(name)) throw new Error(`Namespace is not manually loaded: ${name}`);
    }
    const keep = this.requiredNamespaces(roots);
    const removed = [...this.metadata.keys()].filter((namespace) => !keep.has(namespace));
    const demoted = [...this.roots].filter((namespace) => !roots.includes(namespace));
    for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.namespace)) this.assertClean(flow, {});
    for (const key of this.rootFlows) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.namespace)) this.assertClean(entry.flow, {});
    }
    for (const key of [...this.rootFlows]) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.namespace) && keep.has(entry.ref.namespace))
        await this.unloadFlow(entry.ref);
    }
    for (const namespace of removed) {
      if (this.metadata.has(namespace)) await this.disableNamespace(namespace, {cascade: true});
    }
    this.roots.clear();
    for (const name of roots) this.roots.add(name);
  }

  async unloadNamespace(name: string) {
    if (!this.roots.has(name)) throw new Error(`Namespace is not manually loaded: ${name}`);
    await this.retainNamespaces([...this.roots].filter((root) => root !== name));
  }

  async switchNamespace(name: string) {
    validateNamespace(name);
    const active = new Set(this.metadata.keys());
    const roots = new Set(this.roots);
    await this.enableNamespace(name);
    const keep = this.requiredNamespaces([name]);
    const removed = [...active].filter((namespace) => !keep.has(namespace));
    const demoted = [...roots].filter((namespace) => namespace !== name);
    try {
      for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.namespace)) this.assertClean(flow, {});
      for (const key of this.rootFlows) {
        const entry = this.loaded.get(key);
        if (entry && demoted.includes(entry.ref.namespace)) this.assertClean(entry.flow, {});
      }
    } catch (error) {
      this.roots.clear();
      for (const root of roots) this.roots.add(root);
      for (const namespace of this.metadata.keys()) {
        if (!active.has(namespace)) await this.disableNamespace(namespace, {cascade: true, discardChanges: true});
      }
      throw error;
    }
    for (const key of [...this.rootFlows]) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.namespace) && keep.has(entry.ref.namespace))
        await this.unloadFlow(entry.ref);
    }
    for (const namespace of removed) {
      if (this.metadata.has(namespace)) await this.disableNamespace(namespace, {cascade: true});
    }
    this.roots.clear();
    this.roots.add(name);
  }

  async setNamespaceDependencies(name: string, dependencies: string[]) {
    validateNamespace(name);
    const storage = this.root._storage;
    if (!storage?.getNamespaceMetadata || !storage.saveNamespaceMetadata)
      throw new Error('Storage does not support namespace metadata');
    const updated = readNamespaceMetadata({
      ...(await storage.getNamespaceMetadata(name)),
      dependencies: [...new Set(dependencies)],
    });
    if (!this.metadata.has(name)) {
      await storage.saveNamespaceMetadata(name, updated);
      return;
    }

    const active = new Set(this.metadata.keys());
    await this.activate(updated.dependencies ?? [], this.generation);
    const keep = this.requiredNamespaces(this.roots, {name, metadata: updated});
    const removed = [...active].filter((namespace) => !keep.has(namespace));
    try {
      for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.namespace)) this.assertClean(flow, {});
      await storage.saveNamespaceMetadata(name, updated);
    } catch (error) {
      for (const namespace of [...this.metadata.keys()]) {
        if (!active.has(namespace) && this.metadata.has(namespace))
          await this.disableNamespace(namespace, {cascade: true, discardChanges: true});
      }
      throw error;
    }
    this.metadata.set(name, updated);
    for (const namespace of removed) {
      if (this.metadata.has(namespace)) await this.disableNamespace(namespace, {cascade: true});
    }
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

  loadFlow(ref: FlowRef, prefetched?: Promise<DataMap | null>): Promise<Flow> {
    const key = this.key(ref);
    if (!prefetched && ref.kind === 'flow') this.rootFlows.delete(key);
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
        const context = ref.kind === 'flow' && ref.name === '#context';
        const data = await (prefetched ?? this.readFlow(ref));
        this.checkGeneration(generation);
        if (operation.cancelled || !ns._enabled) throw new Error(`Flow load cancelled: ${key}`);
        if (!data && !context) throw new Error(`Missing ${ref.kind}: ${ref.namespace}/${ref.name}`);
        let flow: Flow;
        if (context) {
          flow = (this.root.getValue(ns.ns) as FlowNameSpace)._contextRoot;
          flow._runtimeDisabled = undefined;
          flow.load(data ?? {}, null, storage?.getFlowLoader(key, flow._prop).applyChange, undefined, ns.ns);
        } else if (ref.kind === 'library') {
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

  async listMainFlows(): Promise<MainFlowEntry[]> {
    const groups = await Promise.all(
      [...this.roots].map(async (namespace) => {
        const flows = await this.listFlows(namespace);
        const metadata = this.metadata.get(namespace);
        const storage = this.root._storage;
        return flows.map(({name, state}) => ({
          namespace,
          name,
          state,
          autoLoad: metadata?.autoLoadFlows?.includes(name) ?? namespace === '#root',
          canAutoLoad: Boolean(
            storage?.saveNamespaceMetadata &&
            (storage.isPersistent ? storage.isPersistent(namespace) : storage.persistent !== false)
          ),
        }));
      })
    );
    return groups.flat();
  }

  async setAutoLoadLibrary(namespace: string, name: string, autoLoad: boolean) {
    this.key({namespace, name, kind: 'library'});
    const storage = this.root._storage;
    if (
      !storage?.saveNamespaceMetadata ||
      (storage.isPersistent ? !storage.isPersistent(namespace) : storage.persistent === false)
    )
      throw new Error('Storage does not support persistence');
    const metadata = await storage.getNamespaceMetadata(namespace);
    const libraries = new Set(metadata.autoLoadLibraries);
    if (autoLoad) libraries.add(name);
    else libraries.delete(name);
    const updated = {...metadata, autoLoadLibraries: [...libraries]};
    await storage.saveNamespaceMetadata(namespace, updated);
    if (this.namespace(namespace)._enabled) {
      this.metadata.set(namespace, updated);
      if (autoLoad) await this.loadFlow({namespace, name, kind: 'library'});
    }
  }

  async setAutoLoadFlow(namespace: string, name: string, autoLoad: boolean) {
    const ref: FlowRef = {namespace, name, kind: 'flow'};
    this.key(ref);
    const storage = this.root._storage;
    if (
      !storage?.saveNamespaceMetadata ||
      (storage.isPersistent ? !storage.isPersistent(namespace) : storage.persistent === false)
    )
      throw new Error('Storage does not support persistence');
    const metadata = await storage.getNamespaceMetadata(namespace);
    if (autoLoad && storage.listFlows && !(await storage.listFlows(namespace)).includes(name)) {
      throw new Error(`Missing flow: ${namespace}/${name}`);
    }
    // A missing #root setting retains the legacy start() behavior of loading all flows.
    const flows = new Set(
      metadata.autoLoadFlows ?? (namespace === '#root' ? await storage.listFlows?.(namespace) : [])
    );
    if (autoLoad) flows.add(name);
    else flows.delete(name);
    const updated = {...metadata, autoLoadFlows: [...flows]};
    await storage.saveNamespaceMetadata(namespace, updated);
    if (this.namespace(namespace)._enabled) {
      this.metadata.set(namespace, updated);
      if (autoLoad && this.roots.has(namespace)) {
        const alreadyLoaded = this.loaded.has(this.key(ref));
        if (!alreadyLoaded) {
          await this.loadFlow(ref);
          this.rootFlows.add(this.key(ref));
        }
      }
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
    this.rootFlows.delete(key);
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
    if (flow && !flow._destroyed) {
      if (ref.kind === 'flow' && ref.name === '#context') {
        (this.root.getValue(`+${ref.namespace}`) as FlowNameSpace)._contextRoot.unload();
      } else {
        flow._prop.setValue(undefined);
      }
    }
    this.loaded.delete(key);
  }

  async setEnabled(ref: FlowRef, enabled: boolean, options: {persist?: boolean} = {}) {
    const key = this.key(ref);
    const flow = this.loaded.get(key)?.flow;
    if (!flow || flow._destroyed) throw new Error(`Flow is not loaded: ${key}`);
    if (options.persist) {
      const storage = this.root._storage;
      if (!storage || (storage.isPersistent ? !storage.isPersistent(ref.namespace) : storage.persistent === false))
        throw new Error('Storage does not support persistence');
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

  getLoadedFlowRefs(namespace: string): FlowRef[] {
    return [...this.loaded.values()].filter(({ref}) => ref.namespace === namespace).map(({ref}) => ({...ref}));
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
      this.roots.delete(ns);
    }
    for (const {ref} of [...this.loaded.values()]) {
      if (removed.has(ref.namespace) && ref.name !== '#context') await this.unloadFlow(ref, options);
    }
    for (const ns of removed) {
      if (ns !== '#root') await this.unloadFlow({namespace: ns, kind: 'flow', name: '#context'}, options);
    }
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
    for (const {ref} of [...this.loaded.values()]) {
      if (ref.name !== '#context') await this.unloadFlow(ref, options);
    }
    for (const {ref} of [...this.loaded.values()]) await this.unloadFlow(ref, options);
    this.metadata.clear();
    this.roots.clear();
    this.suppressed.clear();
    this.rootFlows.clear();
    this.started = false;
  }
}
