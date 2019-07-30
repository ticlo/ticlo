import {BlockProperty, BlockIO, HelperProperty, GlobalProperty} from "./BlockProperty";
import {BlockBinding} from "./BlockBinding";
import {FunctionData, FunctionClass, BaseFunction, FunctionOutput} from "./BlockFunction";
import {Dispatcher, Listener, ValueDispatcher, ListenPromise, Destroyable, BlockBindingSource} from "./Dispatcher";
import {Type, Types} from "./Type";
import {ErrorEvent, Event, EventType, NOT_READY} from "./Event";
import {DataMap} from "../util/Types";
import {Uid} from "../util/Uid";
import {voidProperty} from "./Void";
import {Resolver} from "./Resolver";
import {ConfigGenerators, BlockReadOnlyConfig} from "./BlockConfigs";

export type BlockMode = 'auto' | 'onLoad' | 'onChange' | 'onCall' | 'disabled';

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
    this._block.updateValue('#wait', true);
    promise.then((val: any) => this.onResolve(val)).catch((reason: any) => this.onError(reason));
  }

  onResolve(val: any) {
    if (this._block._funcPromise === this) {
      if (val === undefined) {
        this._block.updateValue('#emit', new Event('complete'));
      } else {
        this._block.updateValue('#emit', val);
      }
      this._block.updateValue('#wait', undefined);
      this._block._funcPromise = undefined;
    }

  }

  onError(reason: any) {
    if (this._block._funcPromise === this) {
      this._block.updateValue('#emit', new ErrorEvent('rejected', reason));
      this._block.updateValue('#wait', undefined);
      this._block._funcPromise = undefined;
    }
  }
}

export class Block implements Runnable, FunctionData, Listener<FunctionClass>, Destroyable {
  private static _uid = new Uid();

  static nextUid(): string {
    return Block._uid.next();
  }

  _blockId = Block.nextUid();

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

//  _cachedFullPath: string;

  constructor(job: Job, parent: Block, prop: BlockProperty) {
    this._job = job;
    this._parent = parent;
    this._prop = prop;
    // #is should always be initialized
    this.getProperty('#is');
  }

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

  wait(val: any, emit?: any): void {
    this.updateValue('#wait', val);
    if (!val) {
      // emit a value when it's no longer waiting
      if (emit !== undefined && this._props.get('#emit')) {
        this._props.get('#emit').updateValue(emit);
      }
    }
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
      if (Root.instance._strictMode) {
        throw new Error("getProperty called after destroy");
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
          prop = new BlockReadOnlyConfig(this, field, this._parent);
          break;
        case '###':
          prop = new BlockReadOnlyConfig(this, field, this._job);
          break;
        case '#':
          prop = new BlockReadOnlyConfig(this, field, this);
          break;
        default: {
          if (!create) {
            return null;
          }
          if (field in ConfigGenerators) {
            prop = new ConfigGenerators[field](this, field);
          } else {
            prop = new BlockProperty(this, field);
          }
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

  createGlobalProperty(name: string): BlockProperty {
    return this._job.getGlobalProperty(name);
  }

  createBinding(path: string, listener: Listener<any>): BlockBindingSource {
    if (this._destroyed) {
      if (Root.instance._strictMode) {
        throw new Error("createBinding called after destroy");
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

    if (path.startsWith("#")) {
      if (path.startsWith("##.")) {
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
      if (key.charCodeAt(0) === 126) { // ~ for binding
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
      if (key.charCodeAt(0) === 126) { // ~ for binding
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
      let block = new Block(this._job, this, prop);
      prop.setValue(block);
      return block;
    }
    return null;
  }

  createOutputBlock(field: string): Block {
    let prop = this.getProperty(field);
    let block = new Block(this._job, this, prop);
    prop.setOutput(block);
    return block;
  }

  createHelperBlock(field: string): Block {
    let prop = this.getProperty(field);
    let helperProp = this.getProperty(`~${field}`) as HelperProperty;
    let block: Block;
    if (!(helperProp._saved instanceof Block) || helperProp._saved._prop !== prop) {
      block = new Block(this._job, this, helperProp);
      helperProp.setValue(block);
    } else {
      block = helperProp._saved;
    }
    prop.setBinding(`~${field}.output`);
    prop.setBindProperty(helperProp);
    return block;
  }

  createOutputJob(field: string, src?: DataMap, output?: FunctionOutput, namespace?: string): Job {
    let prop = this.getProperty(field);
    let job = new Job(this, output, prop);
    prop.setOutput(job);
    if (src) {
      job._namespace = namespace;
      job.load(src);
    }
    return job;
  }

  inputChanged(input: BlockIO, val: any) {
    if (this._function && this._function.inputChanged(input, val)) {
      this._queueFunctionOnChange();
    }
  }

  _cancelFunction(reason: EventType) {
    if (this._function) {
      this._function.cancel(reason);
      this._funcPromise = undefined;
      this.updateValue('#wait', undefined);
    }
  }

  run() {
    this._queueToRun = false;
    if (!this._job._enabled) {
      return;
    }

    if (this._function) {
      if (this._called && this._waiting) {
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
        result = NOT_READY;
      }
      if (this._props.get('#emit')) {
        if (result === undefined) {
          result = new Event('complete');
        }
        this._props.get('#emit').updateValue(result);
      }
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
      if (this._sync) {
        switch (Event.check(val)) {
          case EventType.TRIGGER: {
            if (this._runOnChange && this._runOnLoad && !this._queueToRun) {
              // if sync block has mode onLoad, it can't be called synchronously without a change
              if (this._props.has('#emit')) {
                this._props.get('#emit').updateValue(val);
              }
            } else {
              this._called = true;
              this.run();
            }
            break;
          }
          case EventType.ERROR: {
            this._cancelFunction(EventType.ERROR);
            if (this._props.has('#emit')) {
              this._props.get('#emit').updateValue(val);
            }
            break;
          }
        }
      } else if (this._function) {
        if (Event.check(val) === EventType.TRIGGER) {
          this._called = true;
          this._queueFunction();
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
    if (typeName && typeof (typeName) === 'string') {
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

  onSourceChange(prop: Dispatcher<FunctionClass>): void {
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
        if (this._runOnLoad) {
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
        throw new Error("watch called after destroy");
      }
      return;
    }
    if (this._watchers == null) {
      this._watchers = new Set<BlockChildWatch>();
    }
    this._watchers.add(watcher);
  }

  unwatch(watcher: BlockChildWatch) {
    if (this._destroyed) {
      return;
    }
    this._watchers.delete(watcher);
    if (this._watchers.size === 0) {
      this._watchers = null;
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
}

export class Job extends Block {

  _resolver: Resolver;

  _namespace: string;

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
  updateInput(val: any, forceUpdate: boolean = false) {
    let prop = this.getProperty('#input');
    if (forceUpdate && Object.is(val, prop._value)) {
      prop.updateValue(undefined);
    }
    prop.updateValue(val);
  }

  cancel() {
    this.getProperty('#cancel').updateValue(new Event('cancel'));
  }

  save(): {[key: string]: any} {
    return this._save();
  }

  load(map: {[key: string]: any}) {
    this._loading = true;
    this._load(map);
    this._loading = false;
  }

  liveUpdate(map: {[key: string]: any}) {
    this._loading = true;
    this._liveUpdate(map);
    this._loading = false;
  }

  set onResolved(func: () => void) {
    this._resolver.onResolved = func;
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

  _run = () => {
    this._resolver.run();
    this._resolver._queued = false;
    Event._uid.next();
    for (let onResolved of Resolver._finalResolved) {
      onResolved();
    }
    Resolver._finalResolved.clear();
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
    let globalProp = new BlockReadOnlyConfig(this, '#global');
    this._props.set('#global', globalProp);
    this._globalBlock = new GlobalBlock(this, this, globalProp);
    globalProp._saved = this._globalBlock;
    globalProp._value = globalProp._saved;

    this._props.set('', new BlockReadOnlyConfig(this, '', this));
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

  save(): {[key: string]: any} {
    // not allowed
    return null;
  }

  load(map: {[key: string]: any}) {
    // not allowed
  }

  liveUpdate(map: {[key: string]: any}) {
    // not allowed
  }
}


