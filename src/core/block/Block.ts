import { BlockProperty, BlockPropertyHelper, BlockIO } from "./BlockProperty";
import {
  BlockCallControl,
  BlockClassControl,
  BlockLengthControl,
  BlockModeControl,
  BlockPriorityControl
} from "./BlockControls";
import { BlockBinding } from "./BlockBinding";
import { Job } from "./Job";
import { FunctionData, BlockFunction, FunctionGenerator } from "./BlockFunction";
import { Listener, ValueDispatcher } from "./Dispatcher";

import { Class, Classes } from "./Class";
import { Loop } from "./Loop";
import { Event, FunctionResult } from "./Event";

export type BlockMode = 'auto' | 'always' | 'onChange' | 'onCall' | 'sync' | 'disabled';

export class Block implements FunctionData {
  _job: Job;
  _parent: Block;
  _prop: BlockProperty;
  _gen: number;

  _mode: BlockMode = 'auto';
  _callOnChange: boolean = true;
  _callOnLoad: boolean = false;

  _props: { [key: string]: BlockProperty } = {};
  _bindings: { [key: string]: BlockBinding } = {};
  _function: BlockFunction;
  _className: string;
  _class: Class;

  _called: boolean;
  _queued: boolean;
  _queueDone: boolean;
  _running: boolean;
  _destroyed: boolean;

  _proxy: object;

  constructor(job: Job, parent: Block, prop: BlockProperty) {

    this._job = job;
    this._parent = parent;
    this._prop = prop;

    this._gen = Loop.tick;
  }

  _passThroughFunction: boolean;
  _loop: Loop;

  queueBlock(block: Block) {
    if (this._loop == null) {
      if (this._passThroughFunction) {
        this._parent.queueBlock(block);
      } else {
        this._loop = new Loop((loop: Loop) => {
          if (!this._queued) {
            loop._loopScheduled = true;
            if (this._callOnChange) {
              // put in queue, but _called is not set to true
              // only run the sub loop, not the function
              this._parent.queueBlock(this);
            }
          }
        });
      }
    }
    this._loop.queueBlock(block);
  }

  getRawObject(): any {
    if (!this._proxy) {
      this._proxy = new Proxy(this, blockProxy);
    }
    return this._proxy;
  }

  getProperty(field: string): BlockProperty {
    if (this._destroyed) {
      throw new Error("getProperty called after destroy");
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
        case '#class':
          prop = new BlockClassControl(this, field);
          break;
        case '#mode':
          prop = new BlockModeControl(this, field);
          break;
        case '#call':
          prop = new BlockCallControl(this, field);
          break;
        case '#length':
          prop = new BlockLengthControl(this, field);
          break;
        case '#priority':
          prop = new BlockPriorityControl(this, field);
          break;
        default:
          prop = new BlockProperty(this, field);
      }
    } else if (firstChar === 33) {
      // ! property helper
      prop = new BlockPropertyHelper(this, field);
    } else if (firstChar === 64) {
      // @ attribute
      prop = new BlockProperty(this, field);
    } else {
      prop = new BlockIO(this, field);
    }
    this._props[field] = prop;
    return prop;
  }

  createBinding(path: string, listener: Listener): ValueDispatcher {
    if (this._destroyed) {
      throw new Error("createBinding called after destroy");
    }
    let pos = path.lastIndexOf('.');
    if (pos < 0) {
      let prop = this.getProperty(path);
      prop.listen(listener);
      return prop;
    }

    if (path.startsWith("#")) {
      if (path.startsWith("#parent.")) {
        return this._parent.createBinding(path.substring(8), listener);
      }
      if (path.startsWith('#job.')) {
        return this._job.createBinding(path.substring(5), listener);
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

  _save(): { [key: string]: any } {
    let result: { [key: string]: any } = {};
    for (let name in this._props) {
      let prop = this._props[name];
      if (prop._bindingPath) {
        result[`~${name}`] = prop._bindingPath;
      } else {
        let saved = prop._save();
        if (saved != null) {
          result[name] = saved;
        }
      }
    }
    return result;
  }

  _load(map: { [key: string]: any }) {
    let pendingClass: any;
    for (let key in map) {
      if (key !== '#class') {
        if (key.charCodeAt(0) === 126) { // ~ for binding
          let val = map[key];
          if (typeof val === 'string') {
            let name = key.substring(1);
            this.setBinding(name, val);
          }
        } else {
          this.getProperty(key)._load(map[key]);
        }
      } else {
        pendingClass = map['#class'];
      }
    }
    if (pendingClass) {
      this.setValue('#class', pendingClass);
    }
  }

  // load the data but keep runtime values
  _liveUpdate(map: { [key: string]: any }) {
    let pendingClass: any = map['#class'];
    if (pendingClass !== this._className) {
      // clear the class first so other property change won't cause a function call
      this._classChanged(null);
    }
    for (let key in map) {
      if (key !== '#class') {
        if (key.charCodeAt(0) === 126) { // ~ for binding
          let val = map[key];
          if (typeof val === 'string') {
            let name = key.substring(1);
            this.setBinding(name, val);
          }
        } else {
          this.getProperty(key)._liveUpdate(map[key]);
        }
      }
    }
    if (pendingClass !== this._className) {
      this.setValue('#class', pendingClass);
    }
  }

  setValue(field: string, val: any): void {
    this.getProperty(field).setValue(val);
  }

  updateValue(field: string, val: any): void {
    this.getProperty(field).updateValue(val);
  }

  output(val: any): void {
    this.getProperty('output').updateValue(val);
  }

  setBinding(field: string, path: string): void {
    this.getProperty(field).setBinding(path);
  }

  getValue(field: string): any {
    if (this._props.hasOwnProperty(field)) {
      return this._props[field]._value;
    }
    return undefined;
  }

  createBlock(field: string): Block {
    if (field.charCodeAt(0) > 35) {
      let prop = this.getProperty(field);
      if (!(prop._value instanceof Block) || prop._value._prop !== prop) {
        let block = new Block(this._job, this, prop);
        prop.setValue(block);
        return block;
      }
    }
    return null;
  }

  updateBlock(field: string): Block {
    if (field.charCodeAt(0) > 35) {
      let prop = this.getProperty(field);
      if (!(prop._value instanceof Block) || prop._value._prop !== prop) {
        let block = new Block(this._job, this, prop);
        prop.updateValue(block);
        return block;
      }
    }
    return null;
  }

  inputChanged(input: BlockIO, val: any) {
    if (this._function && this._function.inputChanged(input, val)) {
      this._queueFunctionOnChange();
    }
  }

  run() {
    this._queueDone = true;
    if (!this._job._enabled) {
      return;
    }

    if (this._loop) {
      this._loop._runSchedule();
    }

    if (this._called) {
      this._running = true;
      let result = this._function.run(this);
      this._running = false;
      if (this._props['#emit']) {
        if (result == null) {
          result = new FunctionResult();
        }
        this._props['#emit'].updateValue(result);
      }
      this._called = false;
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
      case 'sync':
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
      if (this._mode === 'sync') {
        if (Event.isValid(val)) {
          if (FunctionResult.isError(val)) {
            if (this._props['#emit']) {
              this._props['#emit'].updateValue(val);
            }
          } else {
            this._called = true;
            this.run();
          }
        }
      } else {
        if (FunctionResult.isValid(val)) {
          this._queueFunction();
        }
      }
    }
  }

  _queueFunctionOnChange() {
    if (this._callOnChange) {
      this._called = true;
      if (!this._queued) {
        if (this._callOnLoad || !this._job._loading) {
          this._parent.queueBlock(this);
        }
      }
    }
  }

  _queueFunction() {
    this._called = true;
    // put it in queue
    if (!this._queued) {
      this._parent.queueBlock(this);
    }
  }


  _classChanged(className: any) {
    if (className === this._className) return;
    if (this._class) {
      this._class.remove(this);
    }
    if (typeof (className) === 'string') {
      this._class = Classes.listen(className, this);
    } else {
      this._class = null;
      this.updateFunction(null);
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

  _controlPriority: number = -1;
  _subQueuePriority: number = -1;

  _priorityChanged(priority: any) {
    if (priority >= 0 && priority <= 3) {
      this._controlPriority = Number(priority);
    }
  }

  getPriority(): number {
    if (this._controlPriority >= 0) {
      return this._controlPriority;
    }
    if (this._function) {
      return this._function.priority;
    }
    if (this._loop && this._loop.isWaiting()) {
      return 3;
    }
    return -1;
  }

  getLength(): number {
    return this._cachedLength;
  }

  updateFunction(generator: FunctionGenerator): void {
    if (this._function) {
      this._function.destroy();
    }
    if (generator) {
      this._function = new generator(this);
      if (this._mode === 'auto') {
        this._configMode();
      }
      if (this._callOnLoad) {
        this._queueFunction();
      }
    } else {
      this._function = null;
      if (this._mode === 'auto') {
        // fast version of this._configMode();
        this._callOnChange = true;
        this._callOnLoad = false;
      }
    }
  }


  destroy(): void {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    if (this._class) {
      this._class.remove(this);
      this._class = null;
    }
    for (let name in this._props) {
      this._props[name].destroy();
    }
    for (let path in this._bindings) {
      this._bindings[path].destroy();
    }
    this._props = null;
    this._bindings = null;
    // TODO
  }
}

const blockProxy = {
  get(block: Block, field: string, receiver: object): any {
    let prop = block._props[field];
    if (prop) {
      let val = prop._value;
      if (val instanceof Block) {
        return prop._value.getProxy();
      }
      return val;
    }
    return null;
  },

  set(block: Block, field: string, value: any, receiver: object): boolean {
    let prop = block.getProperty(field);
    prop.updateValue(value);
    return true;
  }
};

