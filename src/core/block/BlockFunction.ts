import {BlockIO, BlockProperty} from './BlockProperty';
import {FunctionDesc} from './Descriptor';
import {BlockMode, Block} from './Block';
import {Event, EventType} from './Event';
import {DataMap} from '../util/DataTypes';

export interface FunctionOutput {
  // field is 'output' by default
  output(value: any, field?: string): void;
}

export interface FunctionInput {
  getValue(field: string): any;

  getLength(): number;
}

export interface FunctionData extends FunctionInput, FunctionOutput {
  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;
}

export class BaseFunction {
  _data: FunctionData;
  type?: string;
  priority: 0 | 1 | 2 | 3;
  defaultMode: BlockMode;
  useLength: boolean;

  constructor(block?: FunctionData) {
    this._data = block;
  }
  initInputs() {}

  onCall(val: any): boolean {
    return true;
  }
  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }

  // return stream output
  run(): any {
    // to be overridden
  }

  /**
   *  cancel any async operation
   *  return false when function shouldn't be canceled
   */
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto'): boolean {
    return true;
  }

  blockCommand(command: string, params: {[key: string]: any}): any {
    // to be overridden
  }

  // if function can emit a task, use this to load initial worker for WorkerEditor
  getDefaultWorker(field: string): DataMap {
    return null;
  }

  destroy(): void {
    this._data = undefined;
  }
}

export abstract class BlockFunction implements BaseFunction {
  _data: Block;
  priority: 0 | 1 | 2 | 3;
  defaultMode: BlockMode;
  // whether the #len property is used
  useLength: boolean;

  constructor(block?: Block) {
    this._data = block;
  }
  initInputs() {
    for (let [key, callback] of this.getInputMap()) {
      callback.call(this, this._data.getValue(key));
    }
  }

  descriptor: FunctionDesc;

  static emptyInputMap = new Map();
  getInputMap(): Map<string, (this: BlockFunction, val: any) => boolean> {
    return BlockFunction.emptyInputMap;
  }

  onCall(val: any): boolean {
    return true;
  }
  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    const inputCallback = this.getInputMap().get(input._name);
    if (inputCallback) {
      return inputCallback.call(this, val);
    }
    return false;
  }

  // return stream output
  abstract run(): any;

  /**
   *  cancel any async operation
   *  return false when function shouldn't be canceled
   */
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto'): boolean {
    return true;
  }

  blockCommand(command: string, params: {[key: string]: any}): any {
    // to be overridden
  }

  /**
   * Queue the block to be run later
   */
  queue() {
    this._data._queueFunction();
  }

  // if function can emit a task, use this to load initial worker for WorkerEditor
  getDefaultWorker(field: string): DataMap {
    return null;
  }

  destroy(): void {
    this._data = undefined;
  }
}

export type FunctionClass = typeof BaseFunction;
