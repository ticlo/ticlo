import {type FunctionFactory} from './BlockFunction.ts';
import {isDataMap, type DataMap} from '../util/DataTypes.ts';
import {FunctionDispatcher, FunctionModule} from './FunctionModule.ts';
import {FlowStorage} from './Storage.ts';
import {type Flow} from './Flow.ts';
import type {PropListener} from './Dispatcher.ts';
import {deepEqual} from '../util/Compare.ts';

export interface FunctionLoader {
  load(data: DataMap, localFuncId: string, fullId: string, library?: string): FunctionFactory;
}
// A FlowFunctionModule is a FunctionModule that can be saved and loaded inside a Flow.
export class FlowFunctionModule extends FunctionModule {
  static _loaders: Map<string, FunctionLoader> = new Map();
  static registerType(funcType: string, loader: FunctionLoader) {
    this._loaders.set(funcType, loader);
  }

  protected _loading = false;

  constructor(
    flow: Flow,
    public readonly library: string | undefined
  ) {
    super(flow);
  }

  protected trackFlowChange(previous: DataMap | undefined) {
    if (!this._loading && previous && !deepEqual(previous, this.flow.save())) {
      this.flow.trackChange();
    }
  }

  add(factory: FunctionFactory, library?: string | null) {
    const previous = this.flow?.save();
    super.add(factory, library);
    this.trackFlowChange(previous);
  }

  delete(id: string): void {
    const previous = this.flow?.save();
    super.delete(id);
    this.trackFlowChange(previous);
  }

  getFullId(localId: string) {
    return localId;
  }
  getLocalId(fullId: string) {
    return fullId;
  }

  save() {
    let result: DataMap | undefined = undefined;
    for (const key in this._functions) {
      if (this._functions[key].getValue()?.desc) {
        const funcData = this._functions[key].getValue()?.save?.();
        if (funcData) {
          result ??= {};
          result[this.getLocalId(key)] = funcData;
        }
      }
    }
    return result;
  }
  load(data: DataMap) {
    this._loading = true;
    try {
      const usedFullId: Record<string, boolean> = {};
      for (const localFuncId in data) {
        const funcData = data[localFuncId];
        if (isDataMap(funcData) && typeof funcData.type === 'string') {
          const fullId = this.getFullId(localFuncId);
          usedFullId[fullId] = true;
          if (this._functions[fullId]?.getValue()?.equals?.(funcData)) {
            // no need to update existing function
            continue;
          }
          const loader = FlowFunctionModule._loaders.get(funcData.type);
          if (loader) {
            this.add(loader.load(funcData, localFuncId, fullId, this.library), this.library);
          }
        }
      }
      for (const existingId in this._functions) {
        if (!(existingId in usedFullId)) {
          // todo, clean static block
          this.delete(existingId);
        }
      }
    } finally {
      this._loading = false;
    }
  }
}

// A LibraryFunctionModule is a FlowFunctionModule that is associated with a library and a module name.
export class LibraryFunctionModule extends FlowFunctionModule {
  private available = true;
  private readonly runtimeFunctions = new Map<string, FunctionDispatcher>();

  hasRuntimeListeners() {
    return [...this.runtimeFunctions.values()].some((dispatcher) => dispatcher._listeners.size > 0);
  }

  setAvailable(available: boolean) {
    this.available = available;
    for (const [id, dispatcher] of this.runtimeFunctions) {
      dispatcher.updateValue(available ? (this._functions[id]?.getValue() ?? null) : null);
    }
  }

  listen(id: string, listener: PropListener<FunctionFactory | null>): FunctionDispatcher {
    id = this.getFullId(id.startsWith('+:') ? id.slice(id.indexOf(':', 2) + 1) : id);
    let dispatcher = this.runtimeFunctions.get(id);
    if (!dispatcher) {
      dispatcher = new FunctionDispatcher();
      dispatcher.updateValue(this.available ? (this._functions[id]?.getValue() ?? null) : null);
      this.runtimeFunctions.set(id, dispatcher);
    }
    if (listener) dispatcher.listen(listener);
    return dispatcher;
  }

  getWorkerData(id: string): DataMap {
    if (!this.available) return null;
    if (id.startsWith('+:')) id = id.slice(id.indexOf(':', 2) + 1);
    return super.getWorkerData(this.getFullId(id));
  }

  getDescToSend(id: string): [import('./Descriptor.ts').FunctionDesc, number] {
    return super.getDescToSend(id.startsWith('+:') ? this.getFullId(id) : id);
  }

  dispatchDescChange(id: string, desc: import('./Descriptor.ts').FunctionDesc) {
    super.dispatchDescChange(id, desc);
    this.runtimeFunctions.get(id)?.updateValue(this.available ? (this._functions[id]?.getValue() ?? null) : null);
  }

  _loaded: boolean | 'loading' = false;
  pendingSave: Promise<void> | undefined;

  readonly prefix: string;
  constructor(
    flow: Flow,
    library: string,
    public readonly moduleName: string,
    private readonly storage: FlowStorage
  ) {
    super(flow, library);
    this.prefix = `${library}:${moduleName}`;
  }
  getFullId(localId: string) {
    if (localId.startsWith('+:')) localId = localId.slice(localId.indexOf(':', 2) + 1);
    if (localId.charCodeAt(0) === 43 /* + */) {
      return localId;
    }
    if (localId.charCodeAt(0) === 58 /* : */) {
      return `${this.prefix}${localId}`;
    }
    return `${this.prefix}:${localId}`;
  }

  getLocalId(fullId: string) {
    if (fullId.startsWith(this.prefix + ':')) {
      return fullId.substring(this.prefix.length);
    }
    return fullId;
  }

  save() {
    let result: DataMap | undefined = undefined;
    for (const key in this._functions) {
      if (key.charCodeAt(0) === 43 /* + */) {
        continue;
      }
      if (this._functions[key].getValue()?.desc) {
        const funcData = this._functions[key].getValue()?.save?.();
        if (funcData) {
          result ??= {};
          result[key] = funcData;
        }
      }
    }
    return result;
  }

  saveToStorage() {
    if (!this.storage) {
      return;
    }
    const saved = this.storage.saveModule(
      this.library === '+#root' ? '' : this.library,
      this.moduleName,
      this.flow?.save() ?? {'#is': '', '#functions': this.save() ?? {}}
    );
    if (saved instanceof Promise) {
      this.pendingSave = saved;
      saved.catch((error) => {
        this.flow?.updateValue('@save-error', String(error));
        this.flow?.trackChange();
      });
    } else {
      this.pendingSave = undefined;
    }
  }
  load(data: DataMap) {
    this._loaded = 'loading';
    this._loading = true;
    try {
      const usedFullId: Record<string, boolean> = {};
      for (const localFuncId in data) {
        const funcData = data[localFuncId];
        if (isDataMap(funcData) && typeof funcData.type === 'string') {
          const fullId = this.getFullId(localFuncId);
          const localId = this.getLocalId(fullId);
          usedFullId[fullId] = true;
          usedFullId[localId] = true;
          if (
            this._functions[fullId]?.getValue()?.equals?.(funcData) &&
            this._functions[localId]?.getValue()?.equals?.(funcData)
          ) {
            continue;
          }
          const loader = FlowFunctionModule._loaders.get(funcData.type);
          if (loader) {
            this.add(loader.load(funcData, localId, fullId, this.library), this.library);
          }
        }
      }
      for (const existingId in this._functions) {
        if (!(existingId in usedFullId)) {
          this.delete(existingId);
        }
      }
      this._loaded = true;
    } finally {
      this._loading = false;
    }
  }

  add(factory: FunctionFactory, library?: string | null) {
    const fullId = this.getFullId(factory.desc.id);
    const localId = this.getLocalId(fullId);
    super.add({...factory, desc: {...factory.desc, id: localId}}, library);
    super.add({...factory, desc: {...factory.desc, id: fullId}}, library);
    if (this._loaded !== 'loading') {
      this.saveToStorage();
    }
  }

  delete(id: string): void {
    const fullId = this.getFullId(id);
    const localId = this.getLocalId(fullId);
    super.delete(localId);
    super.delete(fullId);
    if (this._loaded !== 'loading') {
      this.saveToStorage();
    }
  }
}
