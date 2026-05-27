import {type Block} from './Block.js';
import {
  type FunctionClass,
  type FunctionApi,
  type FunctionFactory,
  type FunctionFactoryOptions,
  createFunctionFactory,
} from './BlockFunction.js';
import {PropDispatcher, PropListener} from './Dispatcher.js';
import {BlockModeList, FunctionDesc} from './Descriptor.js';
import {DataMap} from '../util/DataTypes.js';
import type {Flow, Root} from './Flow.js';
import {encode} from '../util/Serialize.js';

export {createFunctionFactory};

export interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}

export class FunctionDispatcher extends PropDispatcher<FunctionFactory | null> {}

// FunctionLib is both a registry and a live dispatcher. Blocks listen to a
// FunctionDispatcher by id, so replacing or deleting a function factory updates
// every block currently using that id.
export class FunctionLib {
  _functions: {[key: string]: FunctionDispatcher} = {};
  _listeners: Set<DescListener> = new Set<DescListener>();

  constructor(public flow?: Flow) {}

  add(factory: FunctionFactory, namespace?: string | null, functionApi?: FunctionApi) {
    const desc = factory.desc;
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
    let id: string;
    if (desc.id) {
      id = desc.id;
    } else {
      id = namespace != null ? `${namespace}:${desc.name}` : desc.name;
      desc.id = id;
    }

    factory.desc = desc;
    factory.functionApi = functionApi;
    const cls = factory.cls;
    if (cls) {
      // Copy descriptor defaults onto the prototype so block execution can read
      // mode and priority cheaply from the instantiated function.
      cls.prototype.priority = desc.priority;
      cls.prototype.defaultMode = desc.mode;
      cls.prototype.type = id;
      cls.prototype.isPure ||= Boolean(desc.isPure);
    }

    let func = this._functions[id];
    if (!func) {
      func = new FunctionDispatcher();
      this._functions[id] = func;
    }
    func.updateValue(factory);
    this.dispatchDescChange(id, desc);
  }

  addFactory(
    cls: FunctionClass | null,
    desc: FunctionDesc,
    namespace?: string | null,
    functionApi?: FunctionApi,
    options?: FunctionFactoryOptions
  ) {
    this.add(createFunctionFactory(cls, desc, options), namespace, functionApi);
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
      func = new FunctionDispatcher();
      this._functions[id] = func;
    }
    func.updateValue(createFunctionFactory(null, category));
    this.dispatchDescChange(id, category);
  }

  delete(id: string) {
    const func = this._functions[id];

    if (func) {
      if (func._listeners.size === 0) {
        delete this._functions[id];
      } else {
        func.updateValue(null);
      }
      this.dispatchDescChange(id, null);
    }
  }

  getWorkerData(id: string): DataMap {
    const factory = this._functions[id]?.getValue();
    if (factory?.ticlWorkerData instanceof Object) {
      return factory.ticlWorkerData;
    }
    return null;
  }

  listen(id: string, block: PropListener<FunctionFactory | null>): FunctionDispatcher {
    if (!id) {
      return null;
    }

    let dispatcher = this._functions[id];

    if (!dispatcher) {
      dispatcher = new FunctionDispatcher();
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
      if (this._functions[key].getValue()?.desc) {
        result.push(key);
      }
    }
    return result;
  }

  getDescToSend(id: string): [FunctionDesc, number] {
    const functionDispatcher = this._functions[id];
    const desc = functionDispatcher?.getValue()?.desc;

    if (desc) {
      return [desc, encode(desc).length];
    }
    return [null, 0];
  }

  getDefaultWorker(id: string, block: Block, field: string, blockStack: Map<any, any>): DataMap {
    if (id) {
      const dispatcher = this._functions[id];
      if (dispatcher) {
        return dispatcher.getValue()?.functionApi?.getDefaultWorker?.(block, field, blockStack) || null;
      }
    }
    return null;
  }

  executeCommand(id: string, block: Block, command: string, params: DataMap): unknown {
    if (id) {
      const dispatcher = this._functions[id];
      if (dispatcher) {
        return dispatcher.getValue()?.functionApi?.commands?.[command]?.(block, params);
      }
    }
    return null;
  }
}

export const globalFunctions = new FunctionLib();
export function getGlobalFunctionRoot() {
  return globalFunctions.flow as Root;
}
