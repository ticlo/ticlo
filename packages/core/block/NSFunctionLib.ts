import {type FunctionClass} from './BlockFunction.js';
import {type FunctionDesc} from './Descriptor.js';
import {isDataMap, type DataMap} from '../util/DataTypes.js';
import {type PropListener} from './Dispatcher.js';
import {type FunctionDispatcher, FunctionLib} from './FunctionLib.js';
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

  constructor(
    public readonly namespace?: string,
    private readonly scopePath?: string
  ) {
    super();
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
    let result: DataMap | null = null;
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
    private readonly flow?: Flow
  ) {
    super(namespace, flow?.getFullPath());
    this.prefix = `${namespace}:${libName}`;
  }
  listen(id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    let fullId = id;
    if (id.charCodeAt(0) === 58 /* : */) {
      fullId = `${this.prefix}${id}`;
    } else if (id.charCodeAt(1) === 58 /* : */) {
      // replace +: with current prefix
      fullId = `${this.namespace}${id.substring(1)}`;
    }
    return super.listen(fullId, block);
  }

  getFullId(localId: string) {
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

  saveToStorage() {
    if (!this.storage) {
      return;
    }
    const data = this.flow?.save() ?? {'#is': '', '#functions': this.save()};
    this.storage.saveWorkers(this.namespace, this.libName, data);
  }
  async loadFromStorage() {
    if (!this.storage) {
      return;
    }
    const data = await this.storage.loadWorkers(this.namespace, this.libName);
    if (data) {
      if (this.flow?._loaded) {
        this.flow.liveUpdate(data);
      } else if (data['#functions']) {
        this.load(data['#functions'] as DataMap);
      }
    }
  }

  load(data: DataMap) {
    this._loaded = 'loading';
    super.load(data);
    this._loaded = true;
  }

  add(func: FunctionClass, desc: FunctionDesc, namespace?: string) {
    super.add(func, desc, namespace);
    if (this._loaded !== 'loading') {
      this.saveToStorage();
    }
  }

  delete(id: string): void {
    super.delete(id);
    if (this._loaded !== 'loading') {
      this.saveToStorage();
    }
  }
}
