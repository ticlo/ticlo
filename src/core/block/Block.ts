import {BlockProperty, BlockIO, HelperProperty, GlobalProperty, BlockBindingSource} from './BlockProperty';
import {ListenPromise} from './ListenPromise';
import {BlockBinding} from './BlockBinding';
import {FunctionData, FunctionClass, BaseFunction, FunctionOutput} from './BlockFunction';
import {PropDispatcher, PropListener, Destroyable} from './Dispatcher';
import {Type, Types} from './Type';
import {CompleteEvent, ErrorEvent, Event, EventType, NO_EMIT, WAIT} from './Event';
import {DataMap} from '../util/DataTypes';
import {Uid} from '../util/Uid';
import {voidProperty} from './Void';
import {Resolver} from './Resolver';
import {
  ConfigGenerators,
  BlockConstConfig,
  JobConfigGenerators,
  OutputConfigGenerators,
  InputConfigGenerators
} from './BlockConfigs';
import {FunctionDesc} from './Descriptor';
import {Task} from './Task';

export type BlockMode = 'auto' | 'onLoad' | 'onChange' | 'onCall' | 'disabled';
export const BlockModeList = ['auto', 'onLoad', 'onChange', 'onCall', 'disabled'];

export interface BlockChildWatch {
  onChildChange(property: BlockIO, saved?: boolean): void;
}

export interface Runnable {
  _queued: boolean;
  _queueToRun: boolean;

  getPriority(): number;

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

  _job: Job;
  _parent: Block;
  _prop: BlockProperty;

  _mode: BlockMode = 'auto';
  _runOnChange: boolean = true;
  _runOnLoad: boolean = false;
  _sync: boolean = false;

  _props: Map<string, BlockProperty> = new Map();
  // a cache for blockIO, generated on demand
  _ioCache: Map<string, BlockIO>;
  _bindings: Map<string, BlockBinding> = new Map();
  _function: BaseFunction;
  _funcPromise: PromiseWrapper;
  _typeName: string;
  _type: Type;

  // whether the block has a function running async job
  _waiting: boolean = false;

  // queued in Resolver
  _queued: boolean = false;
  // something to run, if equals to false, Resolve will skip the block
  _queueToRun: boolean = false;

  _running: boolean = false;
  _destroyed: boolean = false;

  _proxy: object;

  constructor(job: Job, parent: Block, prop: BlockProperty) {
    this._job = job;
    this._parent = parent;
    this._prop = prop;
    this._blockId = `${prop?._name}#${Block.nextUid().padStart(3, '0')}`;
    // #is should always be initialized
    this.getProperty('#is');
  }

  // _cachedFullPath: string;
  // fullPath(): string {
  //   if (this._cachedFullPath) {
  //     return this._cachedFullPath;
  //   }
  //   if (this._parent === Root.instance) {
  //     this._cachedFullPath = this._prop._name;
  //   } else {
  //     this._cachedFullPath = this._parent.fullPath() + '.' + this._prop._name;
  //   }
  //   return this._cachedFullPath;
  // }

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
      if (Root.instance._strictMode) {
        throw new Error('getProperty called after destroy');
      } else {
        return voidProperty;
      }
    }
    if (this._props.has(field)) {
      return this._props.get(field);
    }

    // if (field === '') { // comment out self property for now
    //   return this._prop;
    // }

    let firstChar = field.charCodeAt(0);
    let prop: BlockProperty;

    if (firstChar === 35) {
      // # controls
      switch (field) {
        case '##':
          prop = new BlockConstConfig(this, field, this._parent);
          break;
        case '###':
          prop = new BlockConstConfig(this, field, this._job);
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
      return new BlockProperty(this, field);
    }
  }

  createGlobalProperty(name: string): BlockProperty {
    return this._job.getGlobalProperty(name);
  }

  createBinding(path: string, listener: PropListener<any>): BlockBindingSource {
    if (this._destroyed) {
      if (Root.instance._strictMode) {
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
        return this._job.createBinding(path.substring(4), listener);
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
    for (let [name, prop] of this._props) {
      if (prop._bindingPath) {
        result[`~${name}`] = prop._saveBinding();
      } else {
        let saved = prop._save();
        if (saved !== undefined) {
          result[name] = saved;
        }
      }
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
  _liveUpdate(map: DataMap) {
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
    for (let [key, prop] of this._props) {
      // clear properties that don't exist in saved data
      if (!loadedFields.hasOwnProperty(key)) {
        prop.clear();
      }
    }
    // function should change after all the properties
    if (this._pendingClass) {
      this.onChange(this._pendingClass);
      this._pendingClass = null;
    }
  }

  setValue(field: string, val: any): void {
    this.getProperty(field).setValue(val);
  }

  updateValue(field: string, val: any): void {
    this.getProperty(field).updateValue(val);
  }

  output(val: any, field: string = 'output'): void {
    this.getProperty(field).setOutput(val);
  }

  deleteValue(field: string): void {
    let prop = this.getProperty(field, false);
    if (prop) {
      return prop.setValue(undefined);
    }
  }

  setBinding(field: string, path: string): void {
    this.getProperty(field).setBinding(path);
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
    prop.setBinding(`~${field}.output`);
    prop.setBindProperty(helperProp);
    return block;
  }

  createOutputJob(
    field: string,
    src?: DataMap | string,
    output?: FunctionOutput,
    applyChange?: (data: DataMap) => boolean
  ): Job {
    let prop = this.getProperty(field);
    let job = new Job(this, output, prop);
    prop.setOutput(job);
    job.load(src, applyChange);

    return job;
  }

  inputChanged(input: BlockIO, val: any) {
    if (this._function && this._function.inputChanged(input, val)) {
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
    if (!this._job._enabled) {
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
      case 'disabled':
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
    if (this._mode !== 'disabled') {
      if (val === WAIT) {
        // ignore NOT_READY
      } else {
        if (this._function && !this._function.onCall(val)) {
          // rejected by onCall
          return;
        }
        switch (Event.check(val)) {
          case EventType.TRIGGER: {
            if (this._sync) {
              if (this._runOnChange && this._runOnLoad && !this._queueToRun) {
                // if sync block has mode onLoad, it can't be called synchronously without a change
                let prop = this._props.get('#emit');
                if (prop && Object.isExtensible(prop._value) && prop._value.constructor === CompleteEvent) {
                  // re-emit complete event
                  prop.updateValue(new CompleteEvent());
                }
              } else {
                this._called = true;
                this.run();
              }
            } else if (this._function) {
              if (Event.check(val) === EventType.TRIGGER) {
                this._called = true;
                this._queueFunction();
              }
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
        if (this._runOnLoad || !this._job._loading) {
          this._job.queueBlock(this);
        }
      }
    }
  }

  _queueFunction() {
    // put it in queue
    if (!this._queued) {
      this._job.queueBlock(this);
    }
  }

  _syncChanged(sync: any) {
    this._sync = !!sync;
  }

  _typeChanged(typeName: any) {
    if (typeName === this._typeName) return;
    this._typeName = typeName;
    if (this._type) {
      this._type.unlisten(this);
    }
    if (typeName && typeof typeName === 'string') {
      this._type = Types.listen(typeName, this);
    } else {
      this._type = null;
      this.onChange(null);
    }
  }

  _cachedLength: number = NaN;

  _lengthChanged(length: any) {
    let newLen = Number(length);
    if (newLen !== this._cachedLength && (newLen === newLen || this._cachedLength === this._cachedLength)) {
      this._cachedLength = newLen;
      if (this._function && this._function.useLength) {
        this._queueFunctionOnChange();
      }
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

  getLength(): number {
    return this._cachedLength;
  }

  _pendingClass: FunctionClass;

  onSourceChange(prop: PropDispatcher<FunctionClass>): void {
    // not needed
  }

  onChange(cls: FunctionClass): void {
    if (this._function) {
      this._function.destroy();
      this._funcPromise = undefined;
      this.deleteValue('#func');
      this.updateValue('#wait', undefined);
      this._called = false;
    }
    if (cls) {
      if (this._job._loading && cls !== this._pendingClass) {
        // when function changed during load() or liveUpdate()
        // don't create the function until loading is done
        this._pendingClass = cls;
        if (this._function) {
          this._queueToRun = false;
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
    } else if (this._function) {
      this._function = null;
      this._queueToRun = false;
      if (this._mode === 'auto') {
        // fast version of this._configMode();
        this._runOnChange = true;
        this._runOnLoad = false;
      }
    }
  }

  _watchers: Set<BlockChildWatch>;

  watch(watcher: BlockChildWatch) {
    if (this._destroyed) {
      if (Root.instance._strictMode) {
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

  _onChildChanged(property: BlockIO, saved?: boolean) {
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

  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    if (this._type) {
      if (this._function) {
        this._function.destroy();
        this._function = null;
        this._funcPromise = undefined;
        this._called = false;
      }
      this._type.unlisten(this);
      this._type = null;
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
    return `\u001b:Block ${this._blockId}`;
  }
}

export class Job extends Block {
  _resolver: Resolver;

  _namespace: string;
  _loadFrom: string;

  _enabled: boolean = true;
  _loading: boolean = false;

  _outputObj?: FunctionOutput;

  constructor(parent: Block = Root.instance, output?: FunctionOutput, property?: BlockProperty) {
    super(null, null, property);
    this._job = this;
    this._parent = parent;
    this._outputObj = output;
    if (!property) {
      this._prop = new BlockProperty(this, '');
    }

    if (parent) {
      let parentJob = parent._job;
      this._resolver = new Resolver((resolver: Resolver) => {
        parentJob.queueBlock(this._resolver);
      });
    }
  }

  onWait(val: any) {
    let wait = Boolean(val);
    if (!wait && wait !== this._waiting) {
      this._resolver.schedule();
    }
    super.onWait(wait);
  }

  _createConfig(field: string): BlockProperty {
    if (field in JobConfigGenerators) {
      return new JobConfigGenerators[field](this, field);
    } else {
      return new BlockProperty(this, field);
    }
  }

  createGlobalProperty(name: string): BlockProperty {
    let prop = new GlobalProperty(this, name);
    this._props.set(name, prop);
    return prop;
  }

  getGlobalProperty(name: string): BlockProperty {
    return this.getProperty(name);
  }

  queueBlock(block: Runnable) {
    this._resolver.queueBlock(block);
  }

  // return true when the related output block need to be put in queue
  outputChanged(input: BlockIO, val: any): boolean {
    if (this._outputObj) {
      this._outputObj.output(val, input._name);
    }
    return false;
  }

  // make sure the input triggers a change
  updateInput(val: any) {
    let prop = this.getProperty('#input');
    if (prop._value instanceof InputBlock) {
      prop._value._setInputValue(val);
    } else {
      prop.updateValue(val);
    }
    this._resolver.schedule();
  }

  cancel() {
    this.getProperty('#cancel').updateValue(new Event('cancel'));
  }

  save(): DataMap {
    return this._save();
  }

  _applyChange: (data: DataMap) => boolean;
  load(src: DataMap | string, applyChange?: (data: DataMap) => boolean): boolean {
    this._loading = true;
    let loaded = false;
    if (typeof src === 'string') {
      // load from worker class
      let desc: FunctionDesc = Types.getDesc(src)[0];
      if (desc) {
        let data = Types.getWorkerData(src);
        if (data) {
          this._namespace = desc.ns;
          this._loadFrom = src;
          this._load(data);
          loaded = true;
        }
      }
    } else {
      this._namespace = this._job._namespace;
      this._loadFrom = null;
      if (src) {
        this._load(src);
        loaded = true;
      }
    }
    if (loaded) {
      this._applyChange = applyChange;
    }
    this._loading = false;
    return loaded;
  }

  applyChange() {
    if (this._applyChange) {
      return this._applyChange(this.save());
    }
    return false;
  }

  liveUpdate(map: DataMap) {
    this._loading = true;
    this._liveUpdate(map);
    this._loading = false;
  }

  set onResolved(func: () => void) {
    this._resolver.onResolved = func;
  }

  toJsonEsc() {
    return `\u001b:Job ${this._blockId}`;
  }
}

export class GlobalBlock extends Block {
  createGlobalProperty(name: string): BlockProperty {
    let prop = new BlockIO(this, name);
    this._props.set(name, prop);
    return prop;
  }
}

export class Root extends Job {
  private static _instance: Root = new Root();
  static get instance() {
    return this._instance;
  }

  static run() {
    this._instance._run();
  }

  /**
   * resolve recursively
   */
  static runAll(maxRound = 10) {
    for (let i = 0; i < maxRound; ++i) {
      if (this._instance._resolver._queued) {
        this._instance._run();
      } else {
        break;
      }
    }
  }

  _run = () => {
    this._resolver.run();
    this._resolver._queued = false;
    Event._uid.next();
    Resolver._executeFinalResolved();
  };

  _strictMode: boolean = (process.env.NODE_ENV || '').toLowerCase() === 'test';

  _globalBlock: Block;

  constructor() {
    super();
    this._parent = this;
    this._resolver = new Resolver((resolver: Resolver) => {
      resolver._queued = true;
      resolver._queueToRun = true;
      setTimeout(this._run, 0);
    });

    // create the readolny global block
    let globalProp = new BlockConstConfig(this, '#global');
    this._props.set('#global', globalProp);
    this._globalBlock = new GlobalBlock(this, this, globalProp);
    globalProp._saved = this._globalBlock;
    globalProp._value = globalProp._saved;

    this._props.set('', new BlockConstConfig(this, '', this));
  }

  createGlobalProperty(name: string): BlockProperty {
    return this.getGlobalProperty(name);
  }

  getGlobalProperty(name: string): BlockProperty {
    return this._globalBlock.getProperty(name);
  }

  addJob(name?: string): Job {
    if (!name) {
      name = Block.nextUid();
    }
    let prop = this.getProperty(name);
    let newJob = new Job(this, null, prop);
    prop.setValue(newJob);
    return newJob;
  }

  save(): DataMap {
    // not allowed
    return null;
  }

  load(map: DataMap, applyChange?: (data: DataMap) => boolean) {
    // not allowed
    return false;
  }

  liveUpdate(map: DataMap) {
    // not allowed
  }
}

export class InputBlock extends Block {
  _createConfig(field: string): BlockProperty {
    if (field in InputConfigGenerators) {
      return new InputConfigGenerators[field](this, field);
    } else {
      return new BlockProperty(this, field);
    }
  }

  _setInputValue(val: any) {
    if (val instanceof Task) {
      this.updateValue('#value', val.getData());
      val = val.getDataMap();
    } else {
      this.updateValue('#value', val);
    }
    if (Object.isExtensible(val)) {
      let moreList = this.getValue('#more');
      if (Array.isArray(moreList)) {
        for (let moreProp of moreList) {
          this.updateValue(moreProp.name, val[moreProp.name]);
        }
      }
    }
    this.updateValue('#call', new Event('inputChanged'));
  }
}

export class OutputBlock extends Block {
  inputChanged(input: BlockIO, val: any) {
    super.inputChanged(input, val);
    this._job.outputChanged(input, val);
  }

  _createConfig(field: string): BlockProperty {
    if (field in OutputConfigGenerators) {
      return new OutputConfigGenerators[field](this, field);
    } else {
      return new BlockProperty(this, field);
    }
  }
}
