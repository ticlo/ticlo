import {type FunctionClass} from './BlockFunction.js';
import {type FunctionDesc} from './Descriptor.js';
import {isDataMap, type DataMap} from '../util/DataTypes.js';
import {FunctionLib} from './FunctionLib.js';
import {FlowStorage} from './Storage.js';
import {type Flow} from './Flow.js';

export interface FunctionLoader {
  load(data: DataMap, localFuncId: string, fullId: string, namespace?: string): [FunctionClass, FunctionDesc];
}
// A PersistentFunctionLib is a FunctionLib that can be saved and loaded inside a Flow.
export class PersistentFunctionLib extends FunctionLib {
  static _loaders: Map<string, FunctionLoader> = new Map();
  static registerType(funcType: string, loader: FunctionLoader) {
    this._loaders.set(funcType, loader);
  }

  private readonly scopePath?: string;
  constructor(
    public readonly namespace?: string,
    public readonly flow?: Flow
  ) {
    super();
    if (flow) {
      this.scopePath = flow.getFullPath();
    }
  }
  getScopePath(): string | null {
    return this.scopePath ?? null;
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
        const loader = PersistentFunctionLib._loaders.get(funcData.type);
        if (loader) {
          const [func, desc] = loader.load(funcData, localFuncId, fullId, this.namespace);
          this.add(func, desc, this.namespace);
        }
      }
    }
    for (const existingId in this._functions) {
      if (!(existingId in usedFullId)) {
        // todo, clean shared Flow
        this._functions[existingId].updateValue(undefined);
      }
    }
  }
}

// A NsFunctionLib is a PersistentFunctionLib that is associated with a namespace and a lib name.
export class NsFunctionLib extends PersistentFunctionLib {
  _loaded: boolean | 'loading' = false;

  readonly prefix: string;
  constructor(
    namespace: string,
    public readonly libName: string,
    private readonly storage: FlowStorage,
    flow?: Flow
  ) {
    super(namespace, flow);
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
        const loader = PersistentFunctionLib._loaders.get(funcData.type);
        if (loader) {
          const [func, desc] = loader.load(funcData, localId, fullId, this.namespace);
          this.add(func, desc, this.namespace);
        }
      }
    }
    for (const existingId in this._functions) {
      if (!(existingId in usedFullId)) {
        this._functions[existingId].updateValue(undefined);
      }
    }
    this._loaded = true;
  }

  add(func: FunctionClass, desc: FunctionDesc, namespace?: string) {
    const fullId = this.getFullId(desc.id);
    const localId = this.getLocalId(fullId);
    super.add(func, {...desc, id: localId}, namespace);
    super.add(func, {...desc, id: fullId}, namespace);
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
