import JsonEsc from 'jsonesc';
import {Block, BlockModeList} from './Block';
import {FunctionClass} from './BlockFunction';
import {PropDispatcher, PropListener} from './Dispatcher';
import {FunctionDesc} from './Descriptor';
import {DataMap} from '../util/DataTypes';
import {Storage} from './Storage';
import type {Job} from './Job';

export interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}

export class FunctionDispatcher extends PropDispatcher<FunctionClass> {
  _id: string;
  _desc: FunctionDesc;
  _descSize: number = 0;

  constructor(id: string) {
    super();
    this._id = id;
  }

  setDesc(desc?: FunctionDesc) {
    this._desc = desc;
    if (desc) {
      this._descSize = JsonEsc.stringify(desc).length;
    } else {
      this._descSize = 0;
    }
  }
}

const _functions: {[key: string]: FunctionDispatcher} = {};
let _storage: Storage;
export class Functions {
  static add(cls: FunctionClass, desc: FunctionDesc, namespace?: string) {
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
    }

    let func = _functions[id];
    if (!func) {
      func = new FunctionDispatcher(id);
      _functions[id] = func;
    }
    func.updateValue(cls);
    func.setDesc(desc);
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

  static listenBlock(id: string, block: Block): FunctionDispatcher {
    if (!id) {
      return;
    }
    if (id.startsWith(':') && block._job._namespace) {
      id = block._job._namespace + id;
    }
    return Functions.listenRaw(id, block);
  }

  static listenRaw(id: string, block: PropListener<FunctionClass>): FunctionDispatcher {
    let dispatcher = _functions[id];

    if (!dispatcher) {
      dispatcher = new FunctionDispatcher(id);
      _functions[id] = dispatcher;
    }
    dispatcher.listen(block);
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

  static setStorage(storage: Storage) {
    _storage = storage;
  }
  static saveWorkerFunction(funcId: string, job: Job, data: DataMap) {
    _storage?.saveJob(`#.${funcId.substring(1)}`, job, data);
  }
  static deleteFunction(funcId: string) {
    _storage?.deleteJob(`#.${funcId.substring(1)}`);
  }
}
