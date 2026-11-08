import type {Flow, FlowLibrary, Root} from './Flow.ts';
import {Library} from './Library.ts';
import type {LibraryMetadata} from './Storage.ts';
import {libraryPrefix, readLibraryMetadata, validateLibrary} from '../util/LibraryMetadata.ts';
import {validFlowEntry} from '../util/FlowStoragePath.ts';
import {matchEditPath} from '../policy/EditPolicy.ts';
import type {DataMap} from '../util/DataTypes.ts';

export type StartOptions = Record<string, {flows?: string[]}>;
export interface LibraryGraph {
  roots: string[];
  dependencies: Record<string, string[]>;
}
export interface FlowRef {
  library: string;
  kind: 'flow' | 'module';
  name: string;
}
export interface MainFlowEntry {
  library: string;
  name: string;
  state: 'unloaded' | 'loading' | 'enabled' | 'disabled';
  autoLoad: boolean;
  canAutoLoad: boolean;
}
export interface UnloadOptions {
  discardChanges?: boolean;
}

interface PreparedSelection {
  library: string;
  version: number;
  folders: string[];
  flows: {ref: FlowRef; data: Promise<DataMap | null>}[];
}

export function flowRefFromPath(path: string): FlowRef {
  let library = '#root';
  if (path.startsWith('+')) {
    const dot = path.indexOf('.');
    if (dot < 2) throw new Error('Invalid flow path');
    library = path.slice(1, dot);
    if (library === '#root') throw new Error('Root flow paths must be unqualified');
    path = path.slice(dot + 1);
  }
  return {
    library,
    kind: path.startsWith(':') ? 'module' : 'flow',
    name: path.startsWith(':') ? path.slice(1) : path,
  };
}

/** Per-run state. Nothing in this class's catalog or loading sets is serialized. */
export class FlowRuntime {
  started = false;
  private generation = 0;
  private readonly libraryVersions = new Map<string, number>();
  private readonly metadata = new Map<string, LibraryMetadata>();
  private readonly roots = new Set<string>();
  private readonly pending = new Map<string, {promise: Promise<Flow>; cancelled: boolean}>();
  private readonly suppressed = new Set<string>();
  private readonly loaded = new Map<string, {ref: FlowRef; flow: Flow}>();
  private readonly rootFlows = new Set<string>();

  constructor(private readonly root: Root) {}

  private library(name: string) {
    validateLibrary(name);
    return Library.getLibrary(`+${name}`, this.root);
  }

  key(ref: FlowRef) {
    const prefix = libraryPrefix(ref.library);
    if (ref.kind !== 'flow' && ref.kind !== 'module') throw new Error('Invalid flow kind');
    const names = ref.kind === 'module' ? [ref.name] : ref.name.split('.');
    const context = ref.kind === 'flow' && ref.library !== '#root' && ref.name === '#context';
    if (!context && !names.every(validFlowEntry)) throw new Error(`Invalid flow name: ${ref.name}`);
    return `${prefix}${ref.kind === 'module' ? ':' : ''}${ref.name}`;
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
    return ref.kind === 'module'
      ? storage.loadModule(ref.library === '#root' ? '' : `+${ref.library}`, ref.name)
      : storage.loadFlow(this.key(ref));
  }

  private prefetch(ref: FlowRef): Promise<DataMap | null> {
    const data = this.readFlow(ref);
    void data.catch(() => {});
    return data;
  }

  private async activate(names: string[], generation: number) {
    const discovered = new Map<string, LibraryMetadata>();
    const versions = new Map<string, number>();
    const check = () => {
      this.checkGeneration(generation);
      for (const [name, version] of versions) {
        if (this.libraryVersions.get(name) !== version) throw new Error(`Library activation cancelled: ${name}`);
      }
    };
    const visit = async (name: string) => {
      validateLibrary(name);
      if (!versions.has(name)) versions.set(name, this.libraryVersions.get(name));
      if (discovered.has(name) || this.metadata.has(name)) return;
      const data = (await this.root._storage?.getLibraryMetadata?.(name)) ?? {};
      check();
      discovered.set(name, data);
      for (const dependency of data.dependencies ?? []) await visit(dependency);
    };
    for (const name of names) await visit(name);
    check();
    const contexts = [...discovered.keys()]
      .filter((name) => name !== '#root')
      .map((library) => {
        const ref: FlowRef = {library, kind: 'flow', name: '#context'};
        return {ref, data: this.prefetch(ref)};
      });
    const autoLoadModules = [...discovered].flatMap(([library, data]) =>
      (data.autoLoadModules ?? []).map((name) => {
        const ref: FlowRef = {library, kind: 'module', name};
        return {ref, data: this.prefetch(ref)};
      })
    );
    for (const [name, data] of discovered) {
      this.metadata.set(name, data);
      const libraryScope = this.library(name);
      libraryScope._enabled = true;
      if (name !== '#root') this.root.addFlowFolder(libraryScope.libraryId, {});
    }
    try {
      // Contexts replace the library's inheritance layer and load before modules/flows.
      for (const {ref, data} of contexts) {
        await this.loadFlow(ref, data);
        check();
      }
      for (const {ref, data} of autoLoadModules) {
        await this.loadFlow(ref, data);
        check();
      }
      for (const [name] of discovered) {
        // Restore subscriptions created while this library was inactive.
        for (const module of Object.keys(this.library(name)._modules)) {
          if (this.library(name)._modules[module].hasRuntimeListeners()) this.loadModuleOnDemand(name, module);
        }
      }
    } catch (error) {
      for (const [name, data] of discovered) {
        if (
          generation === this.generation &&
          this.metadata.get(name) === data &&
          this.libraryVersions.get(name) === versions.get(name)
        ) {
          await this.disableLibrary(name, {cascade: true, discardChanges: true});
        }
      }
      throw error;
    }
  }

  private async prepareSelected(library: string, patterns: string[], generation: number): Promise<PreparedSelection> {
    const version = this.libraryVersions.get(library);
    if (!patterns.length) return {library, version, folders: [], flows: []};
    if (!this.root._storage?.listFlows) throw new Error('Storage does not support listing flows');
    const folders: string[] = [];
    const names = await this.root._storage.listFlows(library, folders);
    this.checkGeneration(generation);
    if (version !== this.libraryVersions.get(library)) throw new Error(`Library selection cancelled: ${library}`);
    for (const pattern of patterns) {
      if (!/[?*]/.test(pattern) && !names.includes(pattern)) throw new Error(`Missing flow: ${library}/${pattern}`);
    }
    const flows = names
      .filter((name) => patterns.some((pattern) => matchEditPath(pattern, name)))
      .map((name) => {
        const ref: FlowRef = {library, kind: 'flow', name};
        return {ref, data: this.prefetch(ref)};
      });
    return {library, version, folders, flows};
  }

  private async loadSelected({library, version, folders, flows}: PreparedSelection, generation: number) {
    this.checkGeneration(generation);
    if (version !== this.libraryVersions.get(library)) throw new Error(`Library selection cancelled: ${library}`);
    for (const folder of folders) {
      const path = `${libraryPrefix(library)}${folder}`;
      if (!this.root.queryValue(path)) this.root.addFlowFolder(path, {}, true);
    }
    for (const {ref, data} of flows) {
      const key = this.key(ref);
      const alreadyLoaded = this.loaded.has(key);
      await this.loadFlow(ref, data);
      if (!alreadyLoaded) this.rootFlows.add(key);
      this.checkGeneration(generation);
      if (version !== this.libraryVersions.get(library)) throw new Error(`Library selection cancelled: ${library}`);
    }
  }

  async enableLibrary(name: string, options: {flows?: string[]} = {}) {
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

  getLibraryGraph() {
    return {
      roots: [...this.roots],
      dependencies: Object.fromEntries(
        [...this.metadata].map(([name, data]) => [name, [...(data.dependencies ?? [])]])
      ) as Record<string, string[]>,
    };
  }

  private requiredLibraries(roots: Iterable<string>, updated?: {name: string; metadata: LibraryMetadata}) {
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

  async retainLibraries(roots: string[]) {
    for (const name of roots) {
      if (!this.roots.has(name)) throw new Error(`Library is not manually loaded: ${name}`);
    }
    const keep = this.requiredLibraries(roots);
    const removed = [...this.metadata.keys()].filter((library) => !keep.has(library));
    const demoted = [...this.roots].filter((library) => !roots.includes(library));
    for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.library)) this.assertClean(flow, {});
    for (const key of this.rootFlows) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.library)) this.assertClean(entry.flow, {});
    }
    for (const key of [...this.rootFlows]) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.library) && keep.has(entry.ref.library)) await this.unloadFlow(entry.ref);
    }
    for (const library of removed) {
      if (this.metadata.has(library)) await this.disableLibrary(library, {cascade: true});
    }
    this.roots.clear();
    for (const name of roots) this.roots.add(name);
  }

  async unloadLibrary(name: string) {
    if (!this.roots.has(name)) throw new Error(`Library is not manually loaded: ${name}`);
    await this.retainLibraries([...this.roots].filter((root) => root !== name));
  }

  async switchLibrary(name: string) {
    validateLibrary(name);
    const active = new Set(this.metadata.keys());
    const roots = new Set(this.roots);
    await this.enableLibrary(name);
    const keep = this.requiredLibraries([name]);
    const removed = [...active].filter((library) => !keep.has(library));
    const demoted = [...roots].filter((library) => library !== name);
    try {
      for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.library)) this.assertClean(flow, {});
      for (const key of this.rootFlows) {
        const entry = this.loaded.get(key);
        if (entry && demoted.includes(entry.ref.library)) this.assertClean(entry.flow, {});
      }
    } catch (error) {
      this.roots.clear();
      for (const root of roots) this.roots.add(root);
      for (const library of this.metadata.keys()) {
        if (!active.has(library)) await this.disableLibrary(library, {cascade: true, discardChanges: true});
      }
      throw error;
    }
    for (const key of [...this.rootFlows]) {
      const entry = this.loaded.get(key);
      if (entry && demoted.includes(entry.ref.library) && keep.has(entry.ref.library)) await this.unloadFlow(entry.ref);
    }
    for (const library of removed) {
      if (this.metadata.has(library)) await this.disableLibrary(library, {cascade: true});
    }
    this.roots.clear();
    this.roots.add(name);
  }

  async setLibraryDependencies(name: string, dependencies: string[]) {
    validateLibrary(name);
    const storage = this.root._storage;
    if (!storage?.getLibraryMetadata || !storage.saveLibraryMetadata)
      throw new Error('Storage does not support library metadata');
    const updated = readLibraryMetadata({
      ...(await storage.getLibraryMetadata(name)),
      dependencies: [...new Set(dependencies)],
    });
    if (!this.metadata.has(name)) {
      await storage.saveLibraryMetadata(name, updated);
      return;
    }

    const active = new Set(this.metadata.keys());
    await this.activate(updated.dependencies ?? [], this.generation);
    const keep = this.requiredLibraries(this.roots, {name, metadata: updated});
    const removed = [...active].filter((library) => !keep.has(library));
    try {
      for (const {ref, flow} of this.loaded.values()) if (removed.includes(ref.library)) this.assertClean(flow, {});
      await storage.saveLibraryMetadata(name, updated);
    } catch (error) {
      for (const library of [...this.metadata.keys()]) {
        if (!active.has(library) && this.metadata.has(library))
          await this.disableLibrary(library, {cascade: true, discardChanges: true});
      }
      throw error;
    }
    this.metadata.set(name, updated);
    for (const library of removed) {
      if (this.metadata.has(library)) await this.disableLibrary(library, {cascade: true});
    }
  }

  loadModuleOnDemand(library: string, name: string) {
    const ref: FlowRef = {library, kind: 'module', name};
    const key = this.key(ref);
    if (this.suppressed.has(key) || !this.library(library)._enabled) return;
    const generation = this.generation;
    const version = this.libraryVersions.get(library);
    this.loadFlow(ref).catch((error) => {
      if (
        generation !== this.generation ||
        version !== this.libraryVersions.get(library) ||
        !this.library(library)._enabled
      )
        return;
      if (this.getFlowState(ref) !== 'unloaded') return;
      // Keep a failed lazy load from retrying on every resolver pass.
      this.suppressed.add(key);
      this.root.updateValue('@load-error', String(error));
    });
  }

  // REFACTOR(design.md): MUST migrate versioned graph data before activating fixed-type blocks and wires.

  loadFlow(ref: FlowRef, prefetched?: Promise<DataMap | null>): Promise<Flow> {
    const key = this.key(ref);
    if (!prefetched && ref.kind === 'flow') this.rootFlows.delete(key);
    if (!this.library(ref.library)._enabled) return Promise.reject(new Error(`Library is not enabled: ${ref.library}`));
    const existing = this.loaded.get(key)?.flow;
    if (existing && !existing._destroyed) {
      if (this.root._storage?.hasLocalBackup?.(key)) existing.updateValue('@has-change', true);
      return Promise.resolve(existing);
    }
    if (this.pending.has(key)) return this.pending.get(key).promise;
    this.suppressed.delete(key);
    const operation = {promise: undefined as Promise<Flow>, cancelled: false};
    const generation = this.generation;
    operation.promise = Promise.resolve()
      .then(async () => {
        const storage = this.root._storage;
        const libraryScope = this.library(ref.library);
        const context = ref.kind === 'flow' && ref.name === '#context';
        const data = await (prefetched ?? this.readFlow(ref));
        this.checkGeneration(generation);
        if (operation.cancelled || !libraryScope._enabled) throw new Error(`Flow load cancelled: ${key}`);
        if (!data && !context) throw new Error(`Missing ${ref.kind}: ${ref.library}/${ref.name}`);
        let flow: Flow;
        if (context) {
          flow = (this.root.getValue(libraryScope.libraryId) as FlowLibrary)._contextRoot;
          flow._runtimeDisabled = undefined;
          flow.load(
            data ?? {},
            null,
            storage?.getFlowLoader(key, flow._prop).applyChange,
            undefined,
            libraryScope.libraryId
          );
        } else if (ref.kind === 'module') {
          const module = libraryScope.getModule(ref.name, false);
          module.setAvailable(false);
          flow = this.root.addFlowModule(libraryScope.libraryId, ref.name);
          if (!flow) throw new Error(`Conflicting module: ${key}`);
          module.flow = flow;
          flow.load(
            data,
            null,
            async (changed) => {
              const saved = changed.save();
              await storage.saveModule(ref.library === '#root' ? '' : libraryScope.libraryId, ref.name, saved);
              return saved;
            },
            undefined,
            libraryScope.libraryId,
            module
          );
          module.setAvailable(!flow._disabled);
        } else {
          flow = this.root.addFlow(key, data, undefined, true, true);
          if (!flow) throw new Error(`Conflicting flow: ${key}`);
        }
        if (storage?.hasLocalBackup?.(key)) flow.updateValue('@has-change', true);
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

  async listFlows(library: string) {
    validateLibrary(library);
    return ((await this.root._storage?.listFlows?.(library)) ?? []).map((name) => ({
      name,
      state: this.getFlowState({library, kind: 'flow', name}),
    }));
  }

  async listMainFlows(): Promise<MainFlowEntry[]> {
    const groups = await Promise.all(
      [...this.roots].map(async (library) => {
        const flows = await this.listFlows(library);
        const metadata = this.metadata.get(library);
        const storage = this.root._storage;
        return flows.map(({name, state}) => ({
          library,
          name,
          state,
          autoLoad: metadata?.autoLoadFlows?.includes(name) ?? library === '#root',
          canAutoLoad: Boolean(
            storage?.saveLibraryMetadata &&
            (storage.isPersistent ? storage.isPersistent(library) : storage.persistent !== false)
          ),
        }));
      })
    );
    return groups.flat();
  }

  async setAutoLoadModule(library: string, name: string, autoLoad: boolean) {
    this.key({library, name, kind: 'module'});
    const storage = this.root._storage;
    if (
      !storage?.saveLibraryMetadata ||
      (storage.isPersistent ? !storage.isPersistent(library) : storage.persistent === false)
    )
      throw new Error('Storage does not support persistence');
    const metadata = await storage.getLibraryMetadata(library);
    const modules = new Set(metadata.autoLoadModules);
    if (autoLoad) modules.add(name);
    else modules.delete(name);
    const updated = {...metadata, autoLoadModules: [...modules]};
    await storage.saveLibraryMetadata(library, updated);
    if (this.library(library)._enabled) {
      this.metadata.set(library, updated);
      if (autoLoad) await this.loadFlow({library, name, kind: 'module'});
    }
  }

  async setAutoLoadFlow(library: string, name: string, autoLoad: boolean) {
    const ref: FlowRef = {library, name, kind: 'flow'};
    this.key(ref);
    const storage = this.root._storage;
    if (
      !storage?.saveLibraryMetadata ||
      (storage.isPersistent ? !storage.isPersistent(library) : storage.persistent === false)
    )
      throw new Error('Storage does not support persistence');
    const metadata = await storage.getLibraryMetadata(library);
    if (autoLoad && storage.listFlows && !(await storage.listFlows(library)).includes(name)) {
      throw new Error(`Missing flow: ${library}/${name}`);
    }
    // A missing #root setting retains the legacy start() behavior of loading all flows.
    const flows = new Set(metadata.autoLoadFlows ?? (library === '#root' ? await storage.listFlows?.(library) : []));
    if (autoLoad) flows.add(name);
    else flows.delete(name);
    const updated = {...metadata, autoLoadFlows: [...flows]};
    await storage.saveLibraryMetadata(library, updated);
    if (this.library(library)._enabled) {
      this.metadata.set(library, updated);
      if (autoLoad && this.roots.has(library)) {
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

  // REFACTOR(design.md): MUST cancel pending deliveries and detach wires before removing the flow.
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
    if (ref.kind === 'module') {
      const module = this.library(ref.library).getModule(ref.name, false);
      module.setAvailable(false);
      module.load({});
      module.flow = undefined;
    }
    if (flow && !flow._destroyed) {
      if (ref.kind === 'flow' && ref.name === '#context') {
        (this.root.getValue(`+${ref.library}`) as FlowLibrary)._contextRoot.unload();
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
      if (!storage || (storage.isPersistent ? !storage.isPersistent(ref.library) : storage.persistent === false))
        throw new Error('Storage does not support persistence');
      // Persist only this flag, not unrelated unsaved editor changes.
      const libraryId = ref.library === '#root' ? '' : `+${ref.library}`;
      const data = ref.kind === 'module' ? await storage.loadModule(libraryId, ref.name) : await storage.loadFlow(key);
      if (!data) throw new Error(`Missing flow: ${key}`);
      const saved: DataMap = {...data, '#disabled': !enabled};
      if (ref.kind === 'module') await storage.saveModule(libraryId, ref.name, saved);
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

  getLoadedFlowRefs(library: string): FlowRef[] {
    return [...this.loaded.values()].filter(({ref}) => ref.library === library).map(({ref}) => ({...ref}));
  }

  async disableLibrary(name: string, options: UnloadOptions & {cascade?: boolean} = {}) {
    validateLibrary(name);
    const removed = new Set([name]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [other, data] of this.metadata) {
        if (!removed.has(other) && data.dependencies?.some((dependency) => removed.has(dependency))) {
          if (!options.cascade) throw new Error(`Library ${other} depends on ${name}`);
          removed.add(other);
          changed = true;
        }
      }
    }
    for (const {ref, flow} of this.loaded.values()) if (removed.has(ref.library)) this.assertClean(flow, options);
    for (const libraryId of removed) {
      this.libraryVersions.set(libraryId, (this.libraryVersions.get(libraryId) ?? 0) + 1);
      this.library(libraryId)._enabled = false;
      this.metadata.delete(libraryId);
      this.roots.delete(libraryId);
    }
    for (const {ref} of [...this.loaded.values()]) {
      if (removed.has(ref.library) && ref.name !== '#context') await this.unloadFlow(ref, options);
    }
    for (const libraryId of removed) {
      if (libraryId !== '#root') await this.unloadFlow({library: libraryId, kind: 'flow', name: '#context'}, options);
    }
    for (const [key, pending] of this.pending) {
      if (
        [...removed].some(
          (libraryId) => key.startsWith(libraryPrefix(libraryId)) && (libraryId !== '#root' || !key.startsWith('+'))
        )
      ) {
        pending.cancelled = true;
        this.pending.delete(key);
      }
    }
    for (const key of this.suppressed) {
      if (
        [...removed].some(
          (libraryId) => key.startsWith(libraryPrefix(libraryId)) && (libraryId !== '#root' || !key.startsWith('+'))
        )
      )
        this.suppressed.delete(key);
    }
  }

  // REFACTOR(design.md): MUST release all queued event payloads and owned async work on shutdown.
  async stop(options: UnloadOptions = {}) {
    for (const {flow} of this.loaded.values()) this.assertClean(flow, options);
    ++this.generation;
    for (const libraryScope of Object.values(this.root._libraries)) {
      libraryScope._enabled = false;
      for (const module of Object.values(libraryScope._modules)) module.setAvailable(false);
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
