import {type FunctionClass} from './BlockFunction.js';
import {type FunctionDesc} from './Descriptor.js';
import {isDataMap, type DataMap} from '../util/DataTypes.js';
import {type PropListener} from './Dispatcher.js';
import {type FunctionDispatcher, FunctionGroup} from './FunctionGroup.js';
import {FlowStorage} from './Storage.js';

export interface FunctionLoader {
  load(data: DataMap, localFuncId: string, fullId: string, namespace?: string): [FunctionClass, FunctionDesc];
}
// A PersistentFunctionGroup is a FunctionGroup that can be saved and loaded inside a Flow.
export class PersistentFunctionGroup extends FunctionGroup {
  static _loaders: Map<string, FunctionLoader> = new Map();
  static registerType(funcType: string, loader: FunctionLoader) {
    this._loaders.set(funcType, loader);
  }

  constructor(public readonly namespace?: string) {
    super();
  }
  getFullId(localId: string) {
    return localId;
  }

  save() {
    let result: DataMap | null = null;
    for (const key in this._functions) {
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
        const loader = PersistentFunctionGroup._loaders.get(funcData.type);
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

// A NsFunctionGroup is a PersistentFunctionGroup that is associated with a namespace and a group name.
export class NsFunctionGroup extends PersistentFunctionGroup {
  _loaded: boolean | 'loading' = false;

  readonly prefix: string;
  constructor(
    namespace: string,
    public readonly groupName: string,
    private readonly storage: FlowStorage
  ) {
    super(namespace);
    this.prefix = `${namespace}:${groupName}`;
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
    return `${this.namespace}:${this.groupName}:${localId}`;
  }

  saveToStorage() {
    const data = {'#is': 'flow:functions', '#functions': this.save()};
    this.storage.saveWorkers(this.namespace, this.groupName, data);
  }
  async loadFromStorage() {
    const data = await this.storage.loadWorkers(this.namespace, this.groupName);
    if (data && data['#functions']) {
      this.load(data['#functions'] as DataMap);
    }
  }

  add(func: FunctionClass, desc: FunctionDesc, namespace?: string) {
    super.add(func, desc, namespace);
    this.saveToStorage();
  }

  delete(id: string): void {
    super.delete(id);
    this.saveToStorage();
  }
}
