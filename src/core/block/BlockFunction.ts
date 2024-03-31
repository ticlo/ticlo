import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty';
import {BlockMode, Block} from './Block';
import {EventType} from './Event';
import {DataMap} from '../util/DataTypes';

export interface FunctionOutput {
  // field is '#output' by default
  output(value: unknown, field?: string): void;
}

export interface FunctionInput {
  getValue(field: string): unknown;

  getLength(group?: string, defaultLength?: number): number;

  getArray(group?: string, defaultLength?: number, fields?: string[]): unknown[];

  getOptionalProps(): string[];
}

export interface FunctionData extends FunctionInput, FunctionOutput {
  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;
}

export abstract class BaseFunction<T extends FunctionData = FunctionData> {
  declare type?: string;
  declare priority: 0 | 1 | 2 | 3;
  declare defaultMode: BlockMode;

  /**
   * Whether result will always be the same when inputs are same,
   * and function doesn't emit any value.
   */
  abstract isPure: boolean;

  constructor(public _data?: T) {}
  initInputs() {}

  onCall(val: unknown): boolean {
    return val !== undefined;
  }

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: unknown): boolean {
    return true;
  }
  // return true when it needs to be put in queue
  configChanged(config: BlockConfig, val: unknown): boolean {
    return false;
  }

  // return stream output
  abstract run(): unknown;

  /**
   *  cancel any async operation
   *  it can happen when:
   *  - block is called before the previous one is finished, in this case reason=EventType.VOID
   *  - #cancel is triggered
   *  return false when function does not need to be canceled
   */
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto'): boolean {
    return true;
  }

  // cleanup when function is destroyed but data needs to be reused
  cleanup(): void {}
  // destroy the function, any change applied to _data will be handled in cleanup()
  destroy(): void {
    /*
     * this.cancel() should be handled by the destroy() of each function
     * in most case destroy already cancels the logic, no need to duplicate the call.
     */
    /*
     * this.cleanup() is not necessary, since _data will be destroyed.
     */
    this._data = undefined;
  }
}

export abstract class PureFunction extends BaseFunction {
  isPure = true;

  cleanup(): void {
    this._data.output(undefined);
  }
}
export abstract class ImpureFunction extends BaseFunction {
  isPure = false;
}

export abstract class BlockFunction extends BaseFunction<Block> {
  isPure = false;

  initInputs() {
    let inputMap = this.getInputMap();
    if (inputMap) {
      for (let [key, callback] of inputMap) {
        callback.call(this, this._data.getValue(key));
      }
    }
  }

  getInputMap(): Map<string, (this: BlockFunction, val: unknown) => boolean> {
    return null;
  }

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: unknown): boolean {
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
}

export type FunctionClass = new (block: FunctionData) => BaseFunction;
