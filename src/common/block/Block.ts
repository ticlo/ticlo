import {BlockProperty, BlockPropertyHelper, BlockIO} from "./BlockProperty";
import {
  BlockCallConfig,
  BlockClassConfig,
  BlockSyncConfig,
  BlockInputConfig,
  BlockWaitingConfig,
  BlockLengthConfig,
  BlockModeConfig,
  BlockOutputConfig,
  BlockPriorityConfig,
  BlockReadOnlyConfig
} from "./BlockConfigs";
import {BlockBinding} from "./BlockBinding";
import {Job, Root} from "./Job";
import {FunctionData, BlockFunction, FunctionGenerator} from "./BlockFunction";
import {Dispatcher, Listener, ValueDispatcher} from "./Dispatcher";
import {Class, Classes} from "./Class";
import {ErrorEvent, Event, NOT_READY} from "./Event";
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

export class Block implements Runnable, FunctionData, Listener<FunctionGenerator> {
  private static _uid = new Uid();

  static nextUid(): string {
    return Block._uid.next();
  }

  _blockId = Block.nextUid();

  _job: Job;
  _parent: Block;
  _prop: BlockProperty;

  _mode: BlockMode = 'auto';
  _callOnChange: boolean = true;
  _callOnLoad: boolean = false;
  _sync: boolean = false;

  _props: {[key: string]: BlockProperty} = {};
  // a cache for blockIO, generated on demand
  _ioProps: {[key: string]: BlockIO};
  _bindings: {[key: string]: BlockBinding} = {};
  _function: BlockFunction;
  _funcPromise: PromiseWrapper;
  _className: string;
  _class: Class;

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
    this.getProperty('#waiting').setOutput(val);
    if (!val) {
      // emit a value when it's no longer waiting
      if (this._props['#emit']) {
        if (emit === undefined) {
          emit = new Event('asyncComplete');
        }
        this._props['#emit'].updateValue(emit);
      }
    }
  }

  onWait(val: any): void {
    // to be overridden
  }

  queryProperty(path: string, create: boolean = false): BlockProperty {
    return this._queryProperty(path.split('.'), create);
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
      if (field === '##') { // parent
        prop = new BlockReadOnlyConfig(this, field, this._parent);
      } else if (field === '###') { // job
        prop = new BlockReadOnlyConfig(this, field, this._job);
      } else if (field === '#') { // this
        prop = new BlockReadOnlyConfig(this, field, this);
      } else if (!create) {
        return null;
      } else {
        switch (field) {
          case '#is':
            prop = new BlockClassConfig(this, field);
            break;
          case '#mode':
            prop = new BlockModeConfig(this, field);
            break;
          case '#call':
            prop = new BlockCallConfig(this, field);
            break;
          case '#sync':
            prop = new BlockSyncConfig(this, field);
            break;
          case '#length':
            prop = new BlockLengthConfig(this, field);
            break;
          case '#input':
            prop = new BlockInputConfig(this, field);
            break;
          case '#output':
            prop = new BlockOutputConfig(this, field);
            break;
          case '#ready':
            prop = new BlockWaitingConfig(this, field);
            break;
          case '#priority':
            prop = new BlockPriorityConfig(this, field);
            break;
          default:
            prop = new BlockProperty(this, field);
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

  createBinding(path: string, listener: Listener<any>): ValueDispatcher<any> {
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

  createOutputJob(field: string, src?: DataMap, namespace?: string): Job {
    let prop = this.getProperty(field);
    let job = new Job(this, this, prop);
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

  cancel() {
    if (this._function) {
      this._function.cancel();
      this._funcPromise = undefined;
    }
  }

  run() {
    this._queueToRun = false;
    if (!this._job._enabled) {
      return;
    }

    if (this._function) {
      this._running = true;
      let result = this._function.run(this);
      this._running = false;
      if (this._props['#emit']) {
        if (result === undefined) {
          result = new Event('complete');
        } else if (result.constructor === Promise) {
          this._funcPromise = new PromiseWrapper(this);
          this._funcPromise.listen(result);
          if (this._funcPromise === null) {
            // promise already done after listen;
            return;
          }
          result = NOT_READY;
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
    if (this._callOnLoad && this._function != null) {
      this._function.run(this);
    }
  }

  _configMode() {
    let resolvedMode = this._mode;
    if (this._mode === 'auto' && this._function != null) {
      resolvedMode = this._function.defaultMode;
    }
    if (resolvedMode === 'always') {
      this._callOnChange = true;
      this._callOnLoad = true;
    } else if (resolvedMode === 'onChange' || resolvedMode === 'auto') {
      this._callOnChange = true;
      this._callOnLoad = false;
    } else {
      this._callOnChange = false;
      this._callOnLoad = false;
    }
  }

  _onCall(val: any): void {
    if (this._function && this._mode !== 'disabled') {
      if (this._sync) {
        switch (Event.check(val)) {
          case Event.OK: {
            if (this._callOnChange && !this._queueToRun) {
              // pass the event if there is nothing to run
              if (this._props['#emit']) {
                this._props['#emit'].updateValue(val);
              }
            } else {
              this.run();
            }
            break;
          }
          case Event.ERROR: {
            this.cancel();
            if (this._props['#emit']) {
              this._props['#emit'].updateValue(val);
            }
            break;
          }
        }
      } else {
        if (Event.check(val) === Event.OK) {
          this._queueFunction();
        }
      }
    }
  }

  _queueFunctionOnChange() {
    if (this._callOnChange) {
      if (!this._queued) {
        if (this._callOnLoad || !this._job._loading) {
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
      if (this._props.hasOwnProperty('#func')) {
        this._props['#func'].setValue(undefined);
      }
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
        if (this._callOnLoad) {
          this._queueFunction();
        }
      }
    } else if (this._function) {
      this._function = null;
      this._queueToRun = false;
      if (this._mode === 'auto') {
        // fast version of this._configMode();
        this._callOnChange = true;
        this._callOnLoad = false;
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
}


