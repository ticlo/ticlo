import {Block} from './Block';
import {FunctionClass} from './BlockFunction';
import {PropDispatcher, PropListener} from './Dispatcher';
import {BlockModeList, FunctionDesc} from './Descriptor';
import {DataMap} from '../util/DataTypes';
import {FlowStorage} from './Storage';
import type {Flow} from './Flow';
import {encode} from '../util/Serialize';

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

const _functions: {[key: string]: FunctionDispatcher} = {};
let _storage: FlowStorage;
export class Functions {
  static add(cls: FunctionClass | null, desc: FunctionDesc, namespace?: string, functionApi?: FunctionApi) {
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
    let id = namespace != null ? `${namespace}:${desc.name}` : desc.name;
    desc.id = id;

    if (cls) {
      cls.prototype.priority = desc.priority;
      cls.prototype.defaultMode = desc.mode;
      cls.prototype.type = id;
      cls.prototype.isPure ||= Boolean(desc.isPure);
    }

    let func = _functions[id];
    if (!func) {
      func = new FunctionDispatcher(id);
      _functions[id] = func;
    }
    func.updateValue(cls);
    func.setDesc(desc);
    func._functionApi = functionApi;
    Functions.dispatchDescChange(id, desc);
  }
  static addCategory(category: FunctionDesc) {
    if (category.properties) {
      // category should not have properties
      delete category.properties;
    }

    let {id} = category;
    if (!id.endsWith(':')) {
      id = `${id}:`;
      category.id = id;
    }

    let func = _functions[id];
    if (!func) {
      func = new FunctionDispatcher(id);
      _functions[id] = func;
    }
    func.setDesc(category);
    Functions.dispatchDescChange(id, category);
  }

  static clear(id: string) {
    let func = _functions[id];

    if (func) {
      if (func._listeners.size === 0) {
        delete _functions[id];
      } else {
        func.updateValue(null);
        func.setDesc(null);
      }
      if (id.startsWith(':')) {
        Functions.deleteFunction(id);
      }
      Functions.dispatchDescChange(id, null);
    }
  }

  static getWorkerData(id: string): DataMap {
    let func = _functions[id];
    if (func?._value && (func._value as any).ticlWorkerData instanceof Object) {
      return (func._value as any).ticlWorkerData;
    }
    return null;
  }

  static listen(id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    if (!id) {
      return;
    }

    let dispatcher = _functions[id];

    if (!dispatcher) {
      dispatcher = new FunctionDispatcher(id);
      _functions[id] = dispatcher;
    }
    if (block) {
      dispatcher.listen(block);
    }
    return dispatcher;
  }

  static _listeners: Set<DescListener> = new Set<DescListener>();

  static listenDesc(listener: DescListener): void {
    Functions._listeners.add(listener);
  }

  static unlistenDesc(listener: DescListener): void {
    Functions._listeners.delete(listener);
  }

  static dispatchDescChange(id: string, desc: FunctionDesc) {
    for (let listener of Functions._listeners) {
      listener.onDescChange(id, desc);
    }
  }

  static getAllFunctionIds(): string[] {
    let result = [];
    for (let key in _functions) {
      if (_functions[key]._desc) {
        result.push(key);
      }
    }
    return result;
  }

  static getDescToSend(id: string): [FunctionDesc, number] {
    let functionDispatcher = _functions[id];

    if (functionDispatcher) {
      return [functionDispatcher._desc, functionDispatcher._descSize];
    }
    return [null, 0];
  }

  static getDefaultWorker(id: string, block: Block, field: string, blockStack: Map<any, any>): DataMap {
    if (id) {
      let dispatcher = _functions[id];
      if (dispatcher) {
        return dispatcher._functionApi?.getDefaultWorker?.(block, field, blockStack) || null;
      }
    }
    return null;
  }
  static executeCommand(id: string, block: Block, command: string, params: DataMap): unknown {
    if (id) {
      let dispatcher = _functions[id];
      if (dispatcher) {
        return dispatcher._functionApi?.commands?.[command]?.(block, params);
      }
    }
    return null;
  }

  static setStorage(storage: FlowStorage) {
    _storage = storage;
  }
  static saveWorkerFunction(funcId: string, flow: Flow, data: DataMap) {
    _storage?.saveFlow(flow, data, `#.${funcId.substring(1)}`);
  }
  static deleteFunction(funcId: string) {
    _storage?.delete(`#.${funcId.substring(1)}`);
  }
}
