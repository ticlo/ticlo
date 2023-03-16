import {BlockProperty, BlockIO, HelperProperty, BlockBindingSource, BlockConfig} from './BlockProperty';
import {ListenPromise} from './ListenPromise';
import {BlockBinding} from './BlockBinding';
import {FunctionData, FunctionClass, BaseFunction, FunctionOutput} from './BlockFunction';
import {PropDispatcher, PropListener, Destroyable} from './Dispatcher';
import {FunctionDispatcher, Functions} from './Functions';
import {CompleteEvent, ErrorEvent, Event, EventType, NO_EMIT, WAIT} from './Event';
import {DataMap} from '../util/DataTypes';
import {Uid} from '../util/Uid';
import {voidProperty} from './Void';
import {ConfigGenerators, BlockConstConfig, OutputsConfigGenerators, InputsConfigGenerators} from './BlockConfigs';
import {Task} from './Task';
import {_strictMode} from './BlockSettings';

import type {Flow, Root} from './Flow';

export type BlockMode =
  | 'auto' // defined by function
  | 'onLoad' // run onLoad, onChange and onCall
  | 'onChange' // run onChange and onCall
  | 'onCall'; // onCall only

export const BlockModeList = ['auto', 'onLoad', 'onChange', 'onCall'];

export interface BlockChildWatch {
  onChildChange(property: BlockProperty, saved?: boolean): void;

  watchHistory?: boolean;
}

export interface Runnable {
  // in the queue
  _queued: boolean;
  // in the queue and will be run
  _queueToRun: boolean;

  getPriority(): number;

  // return false if not actually run
  run(): void;
}

class PromiseWrapper {
  _block: Block;
  _done: any;

  constructor(block: Block) {
    this._block = block;
  }

  listen(promise: Promise<any>) {
    promise.then((val: any) => this.onResolve(val)).catch((reason: any) => this.onError(reason));
  }

  onResolve(val: any) {
    if (this._block._funcPromise === this) {
      this._block.emit(val);
      this._block._funcPromise = undefined;
    }
  }

  onError(reason: any) {
    if (this._block._funcPromise === this) {
      this._block.emit(new ErrorEvent('rejected', reason));
      this._block._funcPromise = undefined;
    }
  }
}

export class Block implements Runnable, FunctionData, PropListener<FunctionClass>, Destroyable {
  private static _uid = new Uid();

  static nextUid(): string {
    return Block._uid.next();
  }

  _blockId: string;

  _flow: Flow;
  _parent: Block;
  _prop: BlockProperty;

  _disabled: boolean;
  _mode: BlockMode = 'auto';
  _runOnChange = true;
  _runOnLoad = false;
  _sync = false;

  _props: Map<string, BlockProperty> = new Map();
  // a cache for blockIO, generated on demand
  _ioCache: Map<string, BlockIO>;
  _bindings: Map<string, BlockBinding> = new Map();
  _function: BaseFunction;
  _funcPromise: PromiseWrapper;
  _funcId: string;
  _funcSrc: FunctionDispatcher;

  // whether the block has a function running async flow
  _waiting: boolean = false;

  // queued in Resolver
  _queued: boolean = false;
  // something to run, if equals to false, Resolve will skip the block
  _queueToRun: boolean = false;

  _running: boolean = false;
  _destroyed: boolean = false;

  _proxy: object;

  constructor(flow: Flow, parent: Block, prop: BlockProperty) {
    this._flow = flow;
    this._parent = parent;
    this._prop = prop;
    this._disabled = Boolean(flow?._disabled);
    this._blockId = `${this.constructor.name} ${prop?._name}#${Block.nextUid().padStart(3, '0')}`;
    // #is should always be initialized
    this.getProperty('#is');
  }

  _cachedFullPath: string;

  getFullPath(): string {
    if (this._cachedFullPath == null) {
      if (this._parent == null || this._parent === this) {
        // root nodes
        this._cachedFullPath = this._prop._name;
      } else {
        let parentPath = `${this._parent.getFullPath()}.`;
        if (parentPath === '.') {
          parentPath = '';
        }
        this._cachedFullPath = `${parentPath}${this._prop._name}`;
      }
    }
    return this._cachedFullPath;
  }

  onWait(val: any) {
    this._waiting = Boolean(val);
  }

  onCancel(val: any): void {
    if (this._function && Event.check(val) === EventType.TRIGGER) {
      this._cancelFunction(EventType.TRIGGER);
    }
  }

  queryProperty(path: string, create: boolean = false): BlockProperty {
    return this._queryProperty(path.split('.'), create);
  }

  queryValue(path: string): any {
    let prop = this._queryProperty(path.split('.'), false);
    if (prop) {
      return prop._value;
    }
    return undefined;
  }

  _queryProperty(path: string[], create: boolean): BlockProperty {
    let lastIdx = path.length - 1;
    let block: Block = this;
    for (let i = 0; i < lastIdx; ++i) {
      let property = block.getProperty(path[i], false);
      if (property && property._value instanceof Block) {
        block = property._value;
      } else {
        return null;
      }
    }
    return block.getProperty(path[lastIdx], create);
  }

  // return true when there is no value or binding
  isPropertyUsed(field: string) {
    if (this._destroyed) {
      return false;
    }
    if (this._props.has(field)) {
      return !this._props.get(field).isCleared();
    }
    return false;
  }

  getProperty(field: string, create: boolean = true): BlockProperty {
    if (this._destroyed) {
      if (_strictMode) {
        throw new Error('getProperty called after destroy');
      } else {
        return voidProperty;
      }
    }
    let prop: BlockProperty = this._props.get(field);
    if (prop) {
      return prop;
    }

    // if (field === '') { // comment out self property for now
    //   return this._prop;
    // }

    let firstChar = field.charCodeAt(0);

    if (firstChar === 35) {
      // # controls
      switch (field) {
        case '##':
          prop = new BlockConstConfig(this, field, this._parent);
          break;
        case '###':
          prop = new BlockConstConfig(this, field, this._flow);
          break;
        case '#':
          prop = new BlockConstConfig(this, field, this);
          break;
        default: {
          if (!create) {
            return null;
          }
          prop = this._createConfig(field);
        }
      }
    } else if (firstChar === 94) {
      // ^ global
      return this.createGlobalProperty(field);
    } else if (!create) {
      return null;
    } else {
      switch (firstChar) {
        case 126:
          // ~ binding property
          prop = new HelperProperty(this, field);
          break;
        case 64: {
          // @ attribute
          prop = new BlockProperty(this, field);
          break;
        }
        default:
          prop = new BlockIO(this, field);
      }
    }
    this._props.set(field, prop);
    return prop;
  }

  _createConfig(field: string): BlockProperty {
    if (field in ConfigGenerators) {
      return new ConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  createGlobalProperty(name: string): BlockProperty {
    return this._flow.getGlobalProperty(name);
  }

  createBinding(path: string, listener: PropListener<any>): BlockBindingSource {
    if (this._destroyed) {
      if (_strictMode) {
        throw new Error('createBinding called after destroy');
      } else {
        return voidProperty;
      }
    }
    let pos = path.lastIndexOf('.');
    if (pos < 0) {
      let prop = this.getProperty(path);
      prop.listen(listener);
      return prop;
    }

    if (path.startsWith('#')) {
      if (path.startsWith('##.')) {
        return this._parent.createBinding(path.substring(3), listener);
      }
      if (path.startsWith('###.')) {
        return this._flow.createBinding(path.substring(4), listener);
      }
    }

    if (this._bindings.has(path)) {
      let binding = this._bindings.get(path);
      binding.listen(listener);
      return binding;
    }
    let parentPath = path.substring(0, pos);
    let field = path.substring(pos + 1);

    let binding = new BlockBinding(this, path, field);
    this._bindings.set(path, binding);

    binding._parent = this.createBinding(parentPath, binding);
    binding.listen(listener);
    return binding;
  }

  _removeBinding(path: string) {
    this._bindings.delete(path);
  }

  waitValue(path: string, validator?: (val: any) => EventType | boolean): Promise<any> {
    let listenPromise = new ListenPromise(validator);
    listenPromise._valid = true;
    listenPromise._source = this.createBinding(path, listenPromise);
    return listenPromise._promise;
  }

  waitNextValue(path: string, validator?: (val: any) => EventType | boolean): Promise<any> {
    let listenPromise = new ListenPromise(validator);
    listenPromise._source = this.createBinding(path, listenPromise);
    listenPromise._valid = true;
    return listenPromise._promise;
  }

  _save(): DataMap {
    let result: DataMap = {};
    for (let [, prop] of this._props) {
      prop._saveToMap(result);
    }
    return result;
  }

  _load(map: DataMap) {
    for (let key in map) {
      if (key.charCodeAt(0) === 126) {
        // ~ for binding
        let val = map[key];
        if (typeof val === 'string') {
          // normal binding
          let name = key.substring(1);
          this.setBinding(name, val);
        } else {
          // binding helper
          let name = key.substring(1);
          this.createHelperBlock(name)._load(val);
        }
      } else {
        this.getProperty(key)._load(map[key]);
      }
    }
    // function should change after all the properties
    if (this._pendingClass) {
      this.onChange(this._pendingClass);
      this._pendingClass = null;
    }
  }

  // load the data but keep runtime values
  _liveUpdate(map: DataMap, clearUnused = true) {
    let loadedFields: DataMap = {'#is': true};
    for (let key in map) {
      if (key.charCodeAt(0) === 126) {
        // ~ for binding
        let val = map[key];
        if (typeof val === 'string') {
          let name = key.substring(1);
          this.setBinding(name, val);
          loadedFields[name] = true;
        } else {
          // binding helper
          let name = key.substring(1);
          this.createHelperBlock(name)._liveUpdate(val);
          loadedFields[name] = true;
          loadedFields[key] = true;
        }
      } else {
        this.getProperty(key)._liveUpdate(map[key]);
        loadedFields[key] = true;
      }
    }
    if (clearUnused) {
      for (let [key, prop] of this._props) {
        // clear properties that don't exist in saved data
        if (!loadedFields.hasOwnProperty(key)) {
          prop._liveClear();
        }
      }
    }

    // function should change after all the properties
    if (this._pendingClass) {
      this.onChange(this._pendingClass);
      this._pendingClass = null;
    }
  }

  setValue(field: string, val: any): void {
    this.getProperty(field, val !== undefined)?.setValue(val);
  }

  updateValue(field: string, val: any): void {
    this.getProperty(field, val !== undefined)?.updateValue(val);
  }

  output(val: any, field: string = '#output'): void {
    this.getProperty(field, val !== undefined)?.setOutput(val);
  }

  deleteValue(field: string): void {
    let prop = this.getProperty(field, false)?.setValue(undefined);
  }

  setBinding(field: string, path: string): void {
    this.getProperty(field, path != null)?.setBinding(path);
  }

  getValue(field: string): any {
    let prop = this.getProperty(field, false);
    if (prop) {
      return prop.getValue();
    }
    return undefined;
  }

  createBlock(field: string): Block {
    let prop = this.getProperty(field);
    if (!(prop._saved instanceof Block) || prop._saved._prop !== prop) {
      return prop.createBlock(true);
    }
    return null;
  }

  // used by #global and #global.#temp #global.#shared
  _createConstBlock(field: string, generator: (prop: BlockProperty) => Block): BlockConstConfig {
    let constProp = new BlockConstConfig(this, field);
    this._props.set(field, constProp);
    constProp._value = generator(constProp);
    return constProp;
  }

  createOutputBlock(field: string): Block {
    return this.getProperty(field).createBlock(false);
  }

  createHelperBlock(field: string): Block {
    let prop = this.getProperty(field);
    let helperProp = this.getProperty(`~${field}`) as HelperProperty;
    let block: Block;
    if (!(helperProp._saved instanceof Block) || helperProp._saved._prop !== prop) {
      block = helperProp.createBlock(true);
    } else {
      block = helperProp._saved;
    }
    prop.setBinding(`~${field}.#output`);
    prop.setBindProperty(helperProp);
    return block;
  }

  createOutputFlow<T extends Flow>(
    FlowClass: new (parent: Block, output: FunctionOutput, property: BlockProperty) => T,
    field: string,
    src?: DataMap | string,
    output?: FunctionOutput,
    applyChange?: (data: DataMap) => boolean
  ): T {
    let prop = this.getProperty(field);
    let flow = new FlowClass(this, output, prop);
    prop.setOutput(flow);
    if (typeof src === 'string') {
      flow.load(null, src, applyChange);
    } else {
      flow.load(src, null, applyChange);
    }

    return flow;
  }

  inputChanged(input: BlockIO, val: any) {
    if (this._function && this._function.inputChanged(input, val)) {
      this._queueFunctionOnChange();
    }
  }

  configChanged(input: BlockConfig, val: any) {
    if (this._function && this._function.configChanged(input, val)) {
      this._queueFunctionOnChange();
    }
  }

  _cancelFunction(reason: EventType) {
    if (this._function) {
      let result = this._function.cancel(reason, this._mode);
      if (result) {
        this._funcPromise = undefined;
        this.updateValue('#wait', undefined);
      }
      return result;
    }
    return true;
  }

  run() {
    this._queueToRun = false;
    if (!this._flow._enabled) {
      return;
    }

    if (this._function) {
      if (this._called && this._waiting) {
        // previous call is still running, cancel it first
        this._cancelFunction(EventType.VOID);
      }
      this._running = true;
      let result = this._function.run();
      this._running = false;
      this._called = false;
      if (result && result.constructor === Promise) {
        this._funcPromise = new PromiseWrapper(this);
        this._funcPromise.listen(result);
        if (this._funcPromise === null) {
          // promise already done after listen;
          return;
        }
        result = WAIT;
      }
      this.emit(result);
    }
  }

  emit(val: any) {
    if (val === WAIT) {
      this.updateValue('#wait', true);
    } else {
      this.deleteValue('#wait');
      if (val === NO_EMIT) {
        return;
      }
    }
    if (this._props.has('#emit')) {
      if (val === undefined) {
        val = new CompleteEvent();
      }
      this._props.get('#emit').updateValue(val);
    }
  }

  // emit value but maintain the current #wait state
  emitOnly(val: any) {
    if (this._props.has('#emit')) {
      this._props.get('#emit').updateValue(val);
    }
  }

  _modeChanged(mode: any) {
    if (mode === this._mode) {
      return;
    }
    switch (mode) {
      case 'onLoad':
      case 'onChange':
      case 'onCall':
        this._mode = mode;
        break;
      default: {
        if (this._mode === 'auto') {
          return;
        }
        this._mode = 'auto';
      }
    }
    this._configMode();
    if (this._runOnLoad && this._function != null) {
      this._queueFunction();
    }
  }

  _configMode() {
    let resolvedMode = this._mode;
    if (this._mode === 'auto' && this._function != null) {
      resolvedMode = this._function.defaultMode;
    }
    if (resolvedMode === 'onLoad') {
      this._runOnChange = true;
      this._runOnLoad = true;
    } else if (resolvedMode === 'onChange' || resolvedMode === 'auto') {
      this._runOnChange = true;
      this._runOnLoad = false;
    } else {
      this._runOnChange = false;
      this._runOnLoad = false;
    }
  }

  _called = false;

  _onCall(val: any): void {
    if (!this._disabled) {
      if (val === WAIT) {
        // ignore NOT_READY
      } else {
        if (this._function && !this._function.onCall(val)) {
          // rejected by onCall
          // TODO: if #emit and #call is same, need to clear #emit value when #call become undefined
          return;
        }
        switch (Event.check(val)) {
          case EventType.TRIGGER: {
            if (this._function) {
              if (this._sync) {
                if (this._function.isPure && this._runOnChange && !this._queueToRun) {
                  // if function is immutable, it can't be called synchronously without a change
                  let prop = this._props.get('#emit');
                  if (prop && Object.isExtensible(prop._value) && prop._value.constructor === CompleteEvent) {
                    // re-emit complete event
                    prop.updateValue(new CompleteEvent());
                  }
                } else {
                  this._called = true;
                  this.run();
                }
              } else {
                if (Event.check(val) === EventType.TRIGGER) {
                  this._called = true;
                  this._queueFunction();
                }
              }
            } else {
              // this._queueToRun = false; // No need to reset since it won't be set if function is null.
            }
            break;
          }
          case EventType.ERROR: {
            if (this._cancelFunction(EventType.ERROR)) {
              this.emit(val);
            }
            break;
          }
        }
      }
    }
  }

  _queueFunctionOnChange() {
    if (this._runOnChange) {
      if (!this._queued) {
        if (this._runOnLoad || !this._flow._loading) {
          this._flow.queueBlock(this);
        }
      }
    }
  }

  _queueFunction() {
    // put it in queue
    if (!this._queued) {
      this._flow.queueBlock(this);
    } else if (this._queueToRun === null) {
      // It's not run previously, just canceled. So it should be able to run once.
      this._queueToRun = true;
    }
  }

  _flowDisabled() {
    // disable parent before children
    this._disabledChanged(true);
    for (let [key, prop] of this._props) {
      let val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowDisabled();
      }
    }
  }

  _flowEnabled() {
    for (let [key, prop] of this._props) {
      let val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowEnabled();
      }
    }
    // enable children before parent
    this._disabledChanged(this.getValue('#disabled'));
  }

  _disabledChanged(disabled: any) {
    let newDisabled = this._flow._disabled || Boolean(disabled);
    if (newDisabled !== this._disabled) {
      this._disabled = newDisabled;
      if (newDisabled) {
        this._disableBlock();
      } else {
        this._enabledBlock();
      }
    }
  }

  _disableBlock() {
    this._applyFuncid(null);
  }

  _enabledBlock() {
    this._applyFuncid(this._funcId);
  }

  _syncChanged(sync: any) {
    this._sync = !!sync;
  }

  _funcidChanged(funcId: any) {
    if (typeof funcId !== 'string') {
      funcId = null;
    }
    if (this._flow._namespace && funcId?.startsWith(':')) {
      funcId = `${this._flow._namespace}${funcId}`;
    }
    if (funcId === this._funcId) return;
    this._funcId = funcId;
    if (!this._disabled) {
      this._applyFuncid(funcId);
    }
  }

  _applyFuncid(funcId: string) {
    if (this._funcSrc) {
      this._funcSrc.unlisten(this);
    }
    if (funcId) {
      this._funcSrc = Functions.listen(funcId, this);
    } else {
      this._funcSrc = null;
      this.onChange(null);
    }
  }

  // value from #priority
  _controlPriority: number = -1;

  _priorityChanged(priority: any) {
    if (priority >= 0 && priority <= 3) {
      this._controlPriority = Math.round(priority);
    }
  }

  getPriority(): number {
    if (this._controlPriority >= 0) {
      return this._controlPriority;
    }
    if (this._function) {
      return this._function.priority;
    }
    return -1;
  }

  getLength(group?: string, defaultLength = 2): number {
    let result = this.getValue(`${group}[]`);
    if (Array.isArray(result)) {
      return 0;
    }
    if (result >= 0) {
      return result;
    }
    return defaultLength;
  }

  getArray(group = '', defaultLength = 2, fields?: string[]): any[] {
    let lenOrArray = this.getValue(`${group}[]`);
    if (Array.isArray(lenOrArray)) {
      // iterate native array
      return lenOrArray;
    }
    let len: number;
    if (lenOrArray >= 0) {
      len = lenOrArray;
    } else {
      len = defaultLength;
    }
    let result: any[] = [];
    if (len >= 0 && fields) {
      // iterate block array with fields
      for (let i = 0; i < len; ++i) {
        // return object structure
        let obj: any = {};
        for (let field of fields) {
          obj[field] = this.getValue(`${field}${i}`);
        }
        result.push(obj);
      }
    } else {
      // iterate default block array
      for (let i = 0; i < len; ++i) {
        result.push(this.getValue(`${group}${i}`));
      }
    }
    return result;
  }

  getOptionalProps(): string[] {
    let optional = this.getValue('#optional');
    if (Array.isArray(optional)) {
      return optional;
    }
    return [];
  }

  _pendingClass: FunctionClass;

  onSourceChange(prop: PropDispatcher<FunctionClass>): void {
    // not needed
  }

  // function class changed
  onChange(cls: FunctionClass): void {
    if (this._function) {
      this._function.cleanup();
      this._function.destroy();
      this._funcPromise = undefined;
      this.updateValue('#wait', undefined);
      this.updateValue('#emit', undefined);
      this._called = false;
    }
    if (cls) {
      if (this._flow._loading && cls !== this._pendingClass) {
        // when function changed during load() or liveUpdate()
        // don't create the function until loading is done
        this._pendingClass = cls;
        if (this._function) {
          if (this._queueToRun) {
            // set _queueToRun to null indicate it's not run yet
            this._queueToRun = null;
          }
          this._function = null;
        }
      } else {
        this._function = new cls(this);
        if (this._mode === 'auto') {
          this._configMode();
        }
        this._function.initInputs();
        if (this._runOnLoad) {
          let callValue = this.getValue('#call');
          if (callValue !== undefined) {
            this._function.onCall(callValue);
          }
          this._queueFunction();
        }
      }
    } else {
      if (this._function) {
        this._function = null;
        if (this._queueToRun) {
          // set _queueToRun to null indicate it's not run yet
          this._queueToRun = null;
        }
        if (this._mode === 'auto') {
          // fast version of this._configMode();
          this._runOnChange = true;
          this._runOnLoad = false;
        }
      }
      if (this._pendingClass) {
        this._pendingClass = null;
      }
    }
  }

  _watchers: Set<BlockChildWatch>;

  watch(watcher: BlockChildWatch) {
    if (this._destroyed) {
      if (_strictMode) {
        throw new Error('watch called after destroy');
      }
      return;
    }
    if (this._watchers == null) {
      this._watchers = new Set<BlockChildWatch>();
    }
    this._watchers.add(watcher);
  }

  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      this._watchers.delete(watcher);
      if (this._watchers.size === 0) {
        this._watchers = null;
      }
    }
  }

  _onChildChanged(property: BlockProperty, saved?: boolean) {
    for (let watcher of this._watchers) {
      watcher.onChildChange(property, saved);
    }
  }

  _initIoCache() {
    this._ioCache = new Map();
    for (let [field, prop] of this._props) {
      if (prop instanceof BlockIO) {
        this._ioCache.set(field, prop);
      }
    }
  }

  // iterate all BlockIO with a value, ignores all undefined value
  forEach(callback: (field: string, prop: BlockIO) => void) {
    if (!this._ioCache) {
      this._initIoCache();
    }
    for (let [field, prop] of this._ioCache) {
      if (prop._value !== undefined) {
        callback(field, prop);
      }
    }
  }

  // iterate all BlockIO with a value, ignores all undefined value
  findFirst(callback: (field: string, prop: BlockIO) => any): any {
    if (!this._ioCache) {
      this._initIoCache();
    }
    for (let [field, prop] of this._ioCache) {
      if (prop._value !== undefined) {
        let result = callback(field, prop);
        if (result !== undefined) {
          return result;
        }
      }
    }
    return undefined;
  }

  getDefaultWorker(field: string, blockStack?: Map<any, any>): DataMap {
    if (this._funcId) {
      if (!blockStack) {
        blockStack = new Map();
      }
      return Functions.getDefaultWorker(this._funcId, this, field, blockStack);
    }
    return null;
  }

  executeCommand(command: string, params: DataMap): DataMap {
    if (this._funcId) {
      return Functions.executeCommand(this._funcId, this, command, params);
    }
    return null;
  }

  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;

    if (this._funcSrc) {
      if (this._function) {
        this._function.destroy();
        this._function = null;
        this._funcPromise = undefined;
        this._called = false;
      }
      this._funcSrc.unlisten(this);
      this._funcSrc = null;
    }

    // properties are destroyed but not removed
    // the final clean up is handled by GC
    // if the block is still kept in memory, it's still possible to save it after destroy
    for (let [name, prop] of this._props) {
      prop.destroy();
    }
    for (let [path, binding] of this._bindings) {
      binding.destroy();
    }

    this._bindings = null;
    this._queueToRun = false;
    this._watchers = null;
  }

  isDestroyed() {
    return this._destroyed;
  }

  toJsonEsc() {
    return `\u001b:${this._blockId}`;
  }
}

export class InputsBlock extends Block {
  _createConfig(field: string): BlockProperty {
    if (field in InputsConfigGenerators) {
      return new InputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _setInputValue(val: any) {
    if (val instanceof Task) {
      this.updateValue('#value', val.getData());
      val = val.getDataMap();
    } else {
      this.updateValue('#value', val);
    }
    if (val instanceof Block) {
      let customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        for (let customProp of customList) {
          // create raw binding
          this.getProperty(customProp.name)._listenRaw(val.getProperty(customProp.name));
        }
      }
    } else if (Object.isExtensible(val)) {
      let customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        for (let customProp of customList) {
          this.updateValue(customProp.name, val[customProp.name]);
        }
      }
    }
  }
}

export class OutputsBlock extends Block {
  inputChanged(input: BlockIO, val: any) {
    super.inputChanged(input, val);
    this._flow.outputChanged(input, val);
  }

  configChanged(input: BlockConfig, val: any) {
    super.configChanged(input, val);
    switch (input._name) {
      case '#custom':
      case '#value':
        break;
      default:
        this._flow.outputChanged(input, val);
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in OutputsConfigGenerators) {
      return new OutputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}
