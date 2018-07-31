import {BlockProperty, BlockPropertyHelper, BlockIO} from "./BlockProperty";
import {ConfigGenerators, BlockReadOnlyConfig} from "./BlockConfigs";
import {BlockBinding} from "./BlockBinding";
import {Job, Root} from "./Job";
import {FunctionData, FunctionGenerator, BaseFunction, FunctionOutput} from "./BlockFunction";
import {Dispatcher, Listener, ValueDispatcher, ListenPromise, Destroyable} from "./Dispatcher";
import {Class, Classes} from "./Class";
import {ErrorEvent, Event, EventType, NOT_READY} from "./Event";
import {DataMap} from "../util/Types";
import {Uid} from "../util/Uid";
import {voidProperty} from "./Void";

export type BlockMode = 'auto' | 'always' | 'onChange' | 'onCall' | 'disabled';

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
    this._block.updateValue('#waiting', true);
    promise.then((val: any) => this.onResolve(val)).catch((reason: any) => this.onError(reason));
  }

  onResolve(val: any) {
    if (this._block._funcPromise === this) {
      if (val === undefined) {
        this._block.updateValue('#emit', new Event('complete'));
      } else {
        this._block.updateValue('#emit', val);
      }
      this._block.updateValue('#waiting', undefined);
      this._block._funcPromise = undefined;
    }

  }

  onError(reason: any) {
    if (this._block._funcPromise === this) {
      this._block.updateValue('#emit', new ErrorEvent('rejected', reason));
      this._block.updateValue('#waiting', undefined);
      this._block._funcPromise = undefined;
    }
  }
}

export class Block implements Runnable, FunctionData, Listener<FunctionGenerator>, Destroyable {
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

  _props: {[key: string]: BlockProperty} = {};
  // a cache for blockIO, generated on demand
  _ioProps: {[key: string]: BlockIO};
  _bindings: {[key: string]: BlockBinding} = {};
  _function: BaseFunction;
  _funcPromise: PromiseWrapper;
  _className: string;
  _class: Class;


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
    // #is should always be initialized
    this.getProperty('#is');
  }

  emit(event?: any) {
    if (this._props['#emit']) {
      if (!event) {
        event = new Event('asyncComplete');
      }
      this._props['#emit'].updateValue(event);
    }
  }

  wait(val: any, emit?: any): void {
    this.updateValue('#waiting', val);
    if (!val) {
      // emit a value when it's no longer waiting
      if (emit !== undefined && this._props['#emit']) {
        this._props['#emit'].updateValue(emit);
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

  getProperty(field: string, create: boolean = true): BlockProperty {

    if (this._destroyed) {
      if (Root.instance._strictMode) {
        throw new Error("getProperty called after destroy");
      } else {
        return voidProperty;
      }
    }
    if (this._props.hasOwnProperty(field)) {
      return this._props[field];
    }
    if (field === '') {
      return this._prop;
    }
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
    } else if (!create) {
      return null;
    } else {
      switch (firstChar) {
        case 33: {
          // ! property helper
          prop = new BlockPropertyHelper(this, field);
          break;
        }
        case 64: {
          // @ attribute
          prop = new BlockProperty(this, field);
          break;
        }
        default:
          prop = new BlockIO(this, field);
          if (this._ioProps) {
            this._ioProps[field] = prop as BlockIO;
          }
      }
    }
    this._props[field] = prop;
    return prop;
  }

  createBinding(path: string, listener: Listener<any>): ValueDispatcher<any> & Destroyable {
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

    if (this._bindings.hasOwnProperty(path)) {
      let binding = this._bindings[path];
      binding.listen(listener);
      return binding;
    }
    let parentPath = path.substring(0, pos);
    let field = path.substring(pos + 1);

    let binding = new BlockBinding(this, path, field);
    this._bindings[path] = binding;

    binding._parent = this.createBinding(parentPath, binding);
    binding.listen(listener);
    return binding;
  }

  _removeBinding(path: string) {
    delete this._bindings[path];
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
    for (let name in this._props) {
      let prop = this._props[name];

      if (prop._bindingPath) {
        result[`~${name}`] = prop._bindingPath;
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
          let name = key.substring(1);
          this.setBinding(name, val);
        }
      } else {
        this.getProperty(key)._load(map[key]);
      }
    }
    // function should change after all the properties
    if (this._pendingGenerator) {
      this.onChange(this._pendingGenerator);
      this._pendingGenerator = null;
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
        }
      } else {
        this.getProperty(key)._liveUpdate(map[key]);
        loadedFields[key] = true;
      }
    }
    for (let key in this._props) {
      // clear properties that don't exist in saved data
      if (!loadedFields.hasOwnProperty(key)) {
        this._props[key].clear();
      }
    }
    // function should change after all the properties
    if (this._pendingGenerator) {
      this.onChange(this._pendingGenerator);
      this._pendingGenerator = null;
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
      this.updateValue('#waiting', undefined);
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
      if (this._props['#emit']) {
        if (result === undefined) {
          result = new Event('complete');
        }
        this._props['#emit'].updateValue(result);
      }
    }
  }


  _modeChanged(mode: any) {
    if (mode === this._mode) {
      return;
    }
    switch (mode) {
      case 'always':
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
    if (resolvedMode === 'always') {
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
    if (this._function && this._mode !== 'disabled') {
      if (this._sync) {
        switch (Event.check(val)) {
          case EventType.TRIGGER: {
            if (this._runOnChange && !this._queueToRun) {
              // if sync block has mode onChange, it can't be called synchronisly without a change
              if (this._props['#emit']) {
                this._props['#emit'].updateValue(val);
              }
            } else {
              this._called = true;
              this.run();
            }
            break;
          }
          case EventType.ERROR: {
            this._cancelFunction(EventType.ERROR);
            if (this._props['#emit']) {
              this._props['#emit'].updateValue(val);
            }
            break;
          }
        }
      } else {
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

  _classChanged(className: any) {
    if (className === this._className) return;
    this._className = className;
    if (this._class) {
      this._class.unlisten(this);
    }
    if (className && typeof (className) === 'string') {
      this._class = Classes.listen(className, this);
    } else {
      this._class = null;
      this.onChange(null);
    }
  }

  _cachedLength: number = NaN;

  _lengthChanged(length: any) {
    let newLen = Number(length);
    if (newLen !== this._cachedLength && (newLen === newLen || this._cachedLength === this._cachedLength)) {
      this._cachedLength = newLen;
      if (this._function && this._function.descriptor.useLength) {
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

  _pendingGenerator: FunctionGenerator;

  onSourceChange(prop: Dispatcher<FunctionGenerator>): void {
    // not needed
  }

  onChange(generator: FunctionGenerator): void {
    if (this._function) {
      this._function.destroy();
      this._funcPromise = undefined;
      this.deleteValue('#func');
      this.updateValue('#waiting', undefined);
      this._called = false;
    }
    if (generator) {
      if (this._job._loading && generator !== this._pendingGenerator) {
        // when function changed during load() or liveUpdate()
        // don't create the function until loading is done
        this._pendingGenerator = generator;
        if (this._function) {
          this._queueToRun = false;
          this._function = null;
        }
      } else {
        this._function = new generator(this);
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
    this._ioProps = {};
    for (let field in this._props) {
      let prop = this._props[field];
      if (prop instanceof BlockIO) {
        this._ioProps[field] = prop;
      }
    }
  }

  forEach(callback: (field: string, prop: BlockIO) => void) {
    if (!this._ioProps) {
      this._initIoCache();
    }
    for (let field in this._ioProps) {
      let prop = this._ioProps[field];
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
    if (this._class) {
      if (this._function) {
        this._function.destroy();
        this._function = null;
        this._funcPromise = undefined;
        this._called = false;
      }
      this._class.unlisten(this);
      this._class = null;
    }

    // properties are destroyed but not removed
    // the final clean up is handled by GC
    // if the block is still kept in memory, it's still possible to save it after destroy
    for (let name in this._props) {
      this._props[name].destroy();
    }
    for (let path in this._bindings) {
      this._bindings[path].destroy();
    }

    this._bindings = null;
    this._queueToRun = false;
    this._watchers = null;
  }

  isDestroyed() {
    return this._destroyed;
  }
}


