import {Block} from './Block.js';
import {FunctionClass} from './BlockFunction.js';
import {PropDispatcher, PropListener} from './Dispatcher.js';
import {BlockModeList, FunctionDesc} from './Descriptor.js';
import {DataMap} from '../util/DataTypes.js';
import {FlowStorage} from './Storage.js';
import type {Flow} from './Flow.js';
import {encode} from '../util/Serialize.js';

export interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}

interface FunctionApi {
  getDefaultWorker?(block: Block, field: string, blockStack: Map<any, any>): DataMap;
  commands?: {
    // commands
    [key: string]: (block: Block, params: {[key: string]: unknown; property?: string}) => unknown;
  };
}

export class FunctionDispatcher extends PropDispatcher<FunctionClass> {
  _id: string;
  _desc: FunctionDesc;
  _descSize: number = 0;
  _functionApi: FunctionApi;

  constructor(id: string) {
    super();
    this._id = id;
  }

  setDesc(desc?: FunctionDesc) {
    this._desc = desc;
    if (desc) {
      this._descSize = encode(desc).length;
    } else {
      this._descSize = 0;
    }
  }
}

export class Functions {
  _functions: {[key: string]: FunctionDispatcher} = {};
  _storage: FlowStorage;
  _listeners: Set<DescListener> = new Set<DescListener>();

  add(cls: FunctionClass | null, desc: FunctionDesc, namespace?: string, functionApi?: FunctionApi) {
    if (!desc.properties) {
      // function must have properties
      desc.properties = [];
    }
    if (!BlockModeList.includes(desc.mode)) {
      desc.mode = 'onLoad';
    }
    if (![0, 1, 2, 3].includes(desc.priority)) {
      desc.priority = 0;
    }
    desc.ns = namespace;
    if (desc.category && namespace != null) {
      // make sure category is in the same name space
      desc.category = `${namespace}:${desc.category.split(':').pop()}`;
    }
    const id = namespace != null ? `${namespace}:${desc.name}` : desc.name;
    desc.id = id;

    if (cls) {
      cls.prototype.priority = desc.priority;
      cls.prototype.defaultMode = desc.mode;
      cls.prototype.type = id;
      cls.prototype.isPure ||= Boolean(desc.isPure);
    }

    let func = this._functions[id];
    if (!func) {
      func = new FunctionDispatcher(id);
      this._functions[id] = func;
    }
    func.updateValue(cls);
    func.setDesc(desc);
    func._functionApi = functionApi;
    this.dispatchDescChange(id, desc);
  }

  addCategory(category: FunctionDesc) {
    if (category.properties) {
      // category should not have properties
      delete category.properties;
    }

    let {id} = category;
    if (!id.endsWith(':')) {
      id = `${id}:`;
      category.id = id;
    }

    let func = this._functions[id];
    if (!func) {
      func = new FunctionDispatcher(id);
      this._functions[id] = func;
    }
    func.setDesc(category);
    this.dispatchDescChange(id, category);
  }

  clear(id: string) {
    const func = this._functions[id];

    if (func) {
      if (func._listeners.size === 0) {
        delete this._functions[id];
      } else {
        func.updateValue(null);
        func.setDesc(null);
      }
      if (id.startsWith(':')) {
        this.deleteFunction(id);
      }
      this.dispatchDescChange(id, null);
    }
  }

  getWorkerData(id: string): DataMap {
    const func = this._functions[id];
    if (func?._value && (func._value as any).ticlWorkerData instanceof Object) {
      return (func._value as any).ticlWorkerData;
    }
    return null;
  }

  listen(id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    if (!id) {
      return;
    }

    let dispatcher = this._functions[id];

    if (!dispatcher) {
      dispatcher = new FunctionDispatcher(id);
      this._functions[id] = dispatcher;
    }
    if (block) {
      dispatcher.listen(block);
    }
    return dispatcher;
  }

  listenDesc(listener: DescListener): void {
    this._listeners.add(listener);
  }

  unlistenDesc(listener: DescListener): void {
    this._listeners.delete(listener);
  }

  dispatchDescChange(id: string, desc: FunctionDesc) {
    for (const listener of this._listeners) {
      listener.onDescChange(id, desc);
    }
  }

  getAllFunctionIds(): string[] {
    const result = [];
    for (const key in this._functions) {
      if (this._functions[key]._desc) {
        result.push(key);
      }
    }
    return result;
  }

  getDescToSend(id: string): [FunctionDesc, number] {
    const functionDispatcher = this._functions[id];

    if (functionDispatcher) {
      return [functionDispatcher._desc, functionDispatcher._descSize];
    }
    return [null, 0];
  }

  getDefaultWorker(id: string, block: Block, field: string, blockStack: Map<any, any>): DataMap {
    if (id) {
      const dispatcher = this._functions[id];
      if (dispatcher) {
        return dispatcher._functionApi?.getDefaultWorker?.(block, field, blockStack) || null;
      }
    }
    return null;
  }

  executeCommand(id: string, block: Block, command: string, params: DataMap): unknown {
    if (id) {
      const dispatcher = this._functions[id];
      if (dispatcher) {
        return dispatcher._functionApi?.commands?.[command]?.(block, params);
      }
    }
    return null;
  }

  setStorage(storage: FlowStorage) {
    this._storage = storage;
  }

  saveWorkerFunction(funcId: string, flow: Flow, data: DataMap) {
    this._storage?.saveFlow(flow, data, `#.${funcId.substring(1)}`);
  }

  deleteFunction(funcId: string) {
    this._storage?.delete(`#.${funcId.substring(1)}`);
  }
}

export const globalFunctions = new Functions();
