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
import { LogicData, Logic, LogicGenerator } from "./Logic";
import { Listener, ValueDispatcher } from "./Dispatcher";

import { Class, Classes } from "./Class";
import { Loop } from "./Loop";
import { Event, LogicResult } from "./Event";

export type BlockMode = 'auto' | 'manual' | 'disabled' | 'sync';

export class Block implements LogicData {
  _job: Job;
  _parent: Block;
  _prop: BlockProperty;
  _gen: number;

  _mode: BlockMode = 'auto';

  _props: { [key: string]: BlockProperty } = {};
  _bindings: { [key: string]: BlockBinding } = {};
  _logic: Logic = null;
  _className: string = null;
  _class: Class = null;

  _called = false;
  _queued = false;
  _queueDone = false;
  _running = false;

  _proxy: object = null;

  constructor(job: Job, parent: Block, prop: BlockProperty) {

    this._job = job;
    this._parent = parent;
    this._prop = prop;

    this._gen = Loop.tick;
  }

  _passThroughLogic: boolean;
  _loop: Loop;

  queueBlock(block: Block) {
    if (this._loop == null) {
      if (this._passThroughLogic) {
        this._parent.queueBlock(block);
      } else {
        this._loop = new Loop((loop: Loop) => {
          if (!this._queued) {
            loop._loopScheduled = true;
            this._parent.queueBlock(this);
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


  load(map: { [key: string]: any }) {
    this._load(map);
  }

  _load(map: { [key: string]: any }) {
    let pendingClass: string;
    for (let key in map) {
      if (key !== '#class') {
        if (key.charCodeAt(0) === 126) { // ~ for binding
          let val = map[key];
          if (typeof val === 'string') {
            let name = key.substring(1);
            this.setBinding(name, val);
          }
        } else {
          this.getProperty('key')._load(map[key]);
        }
      } else {
        pendingClass = map['#class'];
      }
    }
    if (pendingClass) {
      this.setValue('#class', pendingClass);
    }
  }

  merge(map: { [key: string]: any }) {
    // TODO
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

  inputChanged(input: BlockIO, val: any) {
    if (this._logic) {
      if (this._mode === 'auto' && this._logic.inputChanged(input, val)) {
        this._queueLogic();
      }
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
      let result = this._logic.run();
      this._running = false;
      if (this._props['#pipe']) {
        if (result == null) {
          result = new LogicResult();
        }
        this._props['#pipe'].updateValue(result);
      }
      this._called = false;
    }

  }


  _modeChanged(mode: any) {
    switch (mode) {
      case 'manual':
      case 'sync':
      case 'disabled':
        this._mode = mode;
        break;
      default:
        this._mode = 'auto';
    }
  }

  _onCall(val: any): void {
    if (this._logic && this._mode !== 'disabled') {
      if (this._mode === 'sync') {
        if (Event.isValid(val)) {
          if (LogicResult.isError(val)) {
            if (this._props['#pipe']) {
              this._props['#pipe'].updateValue(val);
            }
          } else {
            this.run();
          }
        }
      } else {
        if (LogicResult.isValid(val)) {
          this._queueLogic();
        }
      }
    }
  }

  _queueLogic() {
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
      this.updateLogic(null);
    }
  }

  _cachedLength: number = NaN;

  _lengthChanged(length: any) {
    let newLen = Number(length);
    if (newLen !== this._cachedLength && (newLen === newLen || this._cachedLength === this._cachedLength)) {
      this._cachedLength = newLen;
      if (this._logic && this._logic.descriptor.useLength && this._mode === 'auto') {
        this._queueLogic();
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
    if (this._logic) {
      return this._logic.priority;
    }
    if (this._loop && this._loop.isWaiting()) {
      return 3;
    }
    return -1;
  }

  getLength(): number {
    return this._cachedLength;
  }

  updateLogic(generator: LogicGenerator): void {
    if (this._logic) {
      this._logic.destroy();
    }
    if (generator) {
      this._logic = new generator(this);
      if (this._logic.checkInitRun(this._mode)) {
        this._queueLogic();
      }
    } else {
      this._logic = null;
    }
  }


  destroy(): void {
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

