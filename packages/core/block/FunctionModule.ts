import {type Block} from './Block.ts';
import {
  type FunctionClass,
  type FunctionApi,
  type FunctionFactory,
  type FunctionFactoryOptions,
  createFunctionFactory,
} from './BlockFunction.ts';
import {PropDispatcher, PropListener} from './Dispatcher.ts';
import {BlockModeList, FunctionDesc} from './Descriptor.ts';
import {DataMap} from '../util/DataTypes.ts';
import type {Flow, Root} from './Flow.ts';
import {Logger} from '../util/Logger.ts';
import {encode} from '../util/Serialize.ts';

export {createFunctionFactory};

export interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}

export const DEFAULT_MAX_WORKER_INSTANCES = 65536;
export const DEFAULT_MAX_MULTI_WORKER_INSTANCES = 8192;

export type FunctionListenMode = 'single' | 'multi' | 'internal';

export class FunctionDispatcher extends PropDispatcher<FunctionFactory | null> {
  _multiListeners?: Set<PropListener<FunctionFactory | null>>;
  _internalListeners?: Set<PropListener<FunctionFactory | null>>;

  hasListeners(): boolean {
    return Boolean(this._listeners.size || this._multiListeners?.size || this._internalListeners?.size);
  }

  private _getLimit(factory: FunctionFactory | null, mode: 'single' | 'multi'): number {
    if (!(factory?.ticlWorkerData instanceof Object)) return Infinity;
    if (factory.maxInstances !== undefined) return factory.maxInstances;
    return mode === 'multi' ? DEFAULT_MAX_MULTI_WORKER_INSTANCES : DEFAULT_MAX_WORKER_INSTANCES;
  }

  private _logLimit(factory: FunctionFactory | null, limit: number) {
    Logger.error(`worker function ${factory?.desc?.id ?? 'unknown'} reached max instances (${limit})`);
  }

  listen(listener: PropListener<FunctionFactory | null>, mode: FunctionListenMode = 'single') {
    if (mode === 'internal') {
      (this._internalListeners ??= new Set()).add(listener);
      listener.onSourceChange?.(this);
      if (!this._updating) {
        listener.onChange(this._value);
      }
      return;
    }
    const set = mode === 'multi' ? (this._multiListeners ??= new Set()) : this._listeners;
    const limit = this._getLimit(this._value, mode);
    if (!set.has(listener) && set.size >= limit) {
      this._logLimit(this._value, limit);
      listener.onSourceChange?.(this);
      listener.onChange(null);
      return;
    }
    set.add(listener);
    listener.onSourceChange?.(this);
    if (!this._updating) {
      listener.onChange(this._value);
    }
  }

  unlisten(listener: PropListener<FunctionFactory | null>) {
    this._listeners.delete(listener);
    this._multiListeners?.delete(listener);
    this._internalListeners?.delete(listener);
  }

  protected _dispatch(): void {
    this._updating = true;
    this._dispatchSet(this._listeners, this._getLimit(this._value, 'single'));
    if (this._multiListeners?.size) {
      this._dispatchSet(this._multiListeners, this._getLimit(this._value, 'multi'));
    }
    if (this._internalListeners?.size) {
      for (const listener of this._internalListeners) {
        listener.onChange(this._value);
      }
    }
    this._updating = false;
  }

  private _dispatchSet(set: Set<PropListener<FunctionFactory | null>>, limit: number) {
    const val = this._value;
    if (limit < Infinity) {
      let count = 0;
      for (const listener of set) {
        if (count < limit) {
          ++count;
          listener.onChange(val);
        } else {
          this._logLimit(val, limit);
          set.delete(listener);
          listener.onChange(null);
        }
      }
    } else {
      for (const listener of set) {
        listener.onChange(val);
      }
    }
  }
}

// FunctionModule is both a registry and a live dispatcher. Blocks listen to a
// FunctionDispatcher by id, so replacing or deleting a function factory updates
// every block currently using that id.
export class FunctionModule {
  _functions: {[key: string]: FunctionDispatcher} = {};
  _listeners: Set<DescListener> = new Set<DescListener>();

  constructor(public flow?: Flow) {}

  // REFACTOR(design.md): Updating a factory MUST NOT swap the type of existing block instances.
  add(factory: FunctionFactory, library?: string | null, functionApi?: FunctionApi) {
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
    desc.libraryId = library;
    let id: string;
    if (desc.id) {
      id = desc.id;
    } else {
      id = library != null ? `${library}:${desc.name}` : desc.name;
      desc.id = id;
    }

    factory.desc = desc;
    factory.functionApi = functionApi ?? factory.functionApi;
    factory.meta ??= {};
    factory.getMeta ??= function (key: string) {
      return this.meta?.[key];
    };
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
    library?: string | null,
    functionApi?: FunctionApi,
    options?: FunctionFactoryOptions
  ) {
    this.add(createFunctionFactory(cls, desc, options), library, functionApi);
  }

  addUniqueFactory(cls: FunctionClass, desc: FunctionDesc, library?: string, functionApi?: FunctionApi) {
    const id = desc.id ?? (library ? `${library}:${desc.name}` : desc.name);
    const existing = this._functions[id]?.getValue();
    if (existing) {
      if (existing.cls !== cls) throw new Error(`A different implementation of ${id} is already registered`);
      return;
    }
    this.addFactory(cls, desc, library, functionApi);
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

  // REFACTOR(design.md): Retiring a type MUST clean up or migrate its instances explicitly.
  delete(id: string) {
    const func = this._functions[id];

    if (func) {
      if (!func.hasListeners()) {
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

  // REFACTOR(design.md): MUST bind each block to its fixed type without live factory-driven type changes.
  listen(
    id: string,
    block: PropListener<FunctionFactory | null>,
    mode: FunctionListenMode = 'single'
  ): FunctionDispatcher {
    if (!id) {
      return null;
    }

    let dispatcher = this._functions[id];

    if (!dispatcher) {
      dispatcher = new FunctionDispatcher();
      this._functions[id] = dispatcher;
    }
    if (block) {
      dispatcher.listen(block, mode);
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

  getDesc(id: string): FunctionDesc {
    return this._functions[id]?.getValue()?.desc ?? null;
  }

  getDescToSend(id: string): [FunctionDesc, number] {
    const desc = this.getDesc(id);
    if (desc) {
      return [desc, encode(desc).length];
    }
    return [null, 0];
  }

  getMeta(id: string, key: string): any {
    return this._functions[id]?.getValue()?.getMeta(key);
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

  executeCommand(id: string, block: Block, command: string, params: DataMap, readonly = false): unknown {
    if (id) {
      const dispatcher = this._functions[id];
      if (dispatcher) {
        return dispatcher.getValue()?.functionApi?.commands?.[command]?.(block, params, readonly);
      }
    }
    return null;
  }
}

export const globalFunctions = new FunctionModule();
export function getGlobalFunctionRoot() {
  return globalFunctions.flow as Root;
}
