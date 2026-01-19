import {type FunctionClass} from '../block/BlockFunction.js';
import {type FunctionDesc} from '../block/Descriptor.js';
import {isDataMap, type DataMap} from '../util/DataTypes.js';
import {type PropListener} from './Dispatcher.js';
import {type FunctionDispatcher, Functions} from './Functions.js';

export interface FunctionLoader {
  load(data: DataMap, localFuncId: string, fullId: string, namespace?: string): [FunctionClass, FunctionDesc];
}
export class FunctionGroup extends Functions {
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
        const loader = FunctionGroup._loaders.get(funcData.type);
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

export class NsFunctionGroup extends FunctionGroup {
  _loaded: boolean | 'loading' = false;

  readonly prefix: string;
  constructor(
    namespace: string,
    public readonly groupName: string
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

  saveToStorage() {}
  loadFromStorage() {}
}
