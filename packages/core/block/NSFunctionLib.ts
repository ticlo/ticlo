import {type FunctionFactory} from './BlockFunction.js';
import {isDataMap, type DataMap} from '../util/DataTypes.js';
import {FunctionLib} from './FunctionLib.js';
import {FlowStorage} from './Storage.js';
import {type Flow} from './Flow.js';
import {deepEqual} from '../util/Compare.js';

export interface FunctionLoader {
  load(data: DataMap, localFuncId: string, fullId: string, namespace?: string): FunctionFactory;
}
// A FlowFunctionLib is a FunctionLib that can be saved and loaded inside a Flow.
export class FlowFunctionLib extends FunctionLib {
  static _loaders: Map<string, FunctionLoader> = new Map();
  static registerType(funcType: string, loader: FunctionLoader) {
    this._loaders.set(funcType, loader);
  }

  protected _loading = false;

  constructor(
    flow: Flow,
    public readonly namespace: string | undefined
  ) {
    super(flow);
  }

  protected trackFlowChange(previous: DataMap | undefined) {
    if (!this._loading && previous && !deepEqual(previous, this.flow.save())) {
      this.flow.trackChange();
    }
  }

  add(factory: FunctionFactory, namespace?: string | null) {
    const previous = this.flow?.save();
    super.add(factory, namespace);
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
      if (this._functions[key]._desc) {
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
          if (this._functions[fullId]?._value?.equals?.(funcData)) {
            // no need to update existing function
            continue;
          }
          const loader = FlowFunctionLib._loaders.get(funcData.type);
          if (loader) {
            this.add(loader.load(funcData, localFuncId, fullId, this.namespace), this.namespace);
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

// A NsFunctionLib is a FlowFunctionLib that is associated with a namespace and a lib name.
export class NsFunctionLib extends FlowFunctionLib {
  _loaded: boolean | 'loading' = false;

  readonly prefix: string;
  constructor(
    flow: Flow,
    namespace: string,
    public readonly libName: string,
    private readonly storage: FlowStorage
  ) {
    super(flow, namespace);
    this.prefix = `${namespace}:${libName}`;
  }
  getFullId(localId: string) {
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
      if (this._functions[key]._desc) {
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
    this.storage.saveLib(
      this.namespace,
      this.libName,
      this.flow?.save() ?? {'#is': '', '#functions': this.save() ?? {}}
    );
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
            this._functions[fullId]?._value?.equals?.(funcData) &&
            this._functions[localId]?._value?.equals?.(funcData)
          ) {
            continue;
          }
          const loader = FlowFunctionLib._loaders.get(funcData.type);
          if (loader) {
            this.add(loader.load(funcData, localId, fullId, this.namespace), this.namespace);
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

  add(factory: FunctionFactory, namespace?: string | null) {
    const fullId = this.getFullId(factory.desc.id);
    const localId = this.getLocalId(fullId);
    super.add({...factory, desc: {...factory.desc, id: localId}}, namespace);
    super.add({...factory, desc: {...factory.desc, id: fullId}}, namespace);
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
