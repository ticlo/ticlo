import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty';
import {BlockMode, Block} from './Block';
import {EventType} from './Event';
import {DataMap} from '../util/DataTypes';

export interface FunctionOutput {
  // field is '#output' by default
  output(value: any, field?: string): void;
}

export interface FunctionInput {
  getValue(field: string): any;

  getLength(group?: string, defaultLength?: number): number;

  getArray(group?: string, defaultLength?: number, fields?: string[]): any[];

  getOptionalProps(): string[];
}

export interface FunctionData extends FunctionInput, FunctionOutput {
  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;
}

export abstract class BaseFunction<T extends FunctionData = FunctionData> {
  type?: string;
  priority: 0 | 1 | 2 | 3;
  defaultMode: BlockMode;

  constructor(public _data?: T) {}
  initInputs() {}

  onCall(val: any): boolean {
    return true;
  }

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }
  // return true when it needs to be put in queue
  configChanged(config: BlockConfig, val: any): boolean {
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

  cleanup(): void {
    this._data.output(undefined);
  }
  destroy(): void {
    this._data = undefined;
  }
}

export abstract class BlockFunction extends BaseFunction<Block> {
  initInputs() {
    let inputMap = this.getInputMap();
    if (inputMap) {
      for (let [key, callback] of inputMap) {
        callback.call(this, this._data.getValue(key));
      }
    }
  }

  getInputMap(): Map<string, (this: BlockFunction, val: any) => boolean> {
    return null;
  }

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    let inputMap = this.getInputMap();
    if (inputMap) {
      const inputCallback = this.getInputMap().get(input._name);
      if (inputCallback) {
        return inputCallback.call(this, val);
      }
      // when inputMap is defined, ignore the change of other parameters
      return false;
    }
    return true;
  }

  /**
   * Queue the block to be run later
   */
  queue() {
    this._data._queueFunction();
  }

  cleanup(): void {}
}

export type FunctionClass = new (block: FunctionData) => BaseFunction;
