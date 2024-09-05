import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty';
import {type Block} from './Block';
import {EventType} from './Event';
import {BlockMode} from './Descriptor';
import {type FunctionData} from './FunctonData';

export class BaseFunction<T extends FunctionData = FunctionData> {
  declare type?: string;
  declare priority: 0 | 1 | 2 | 3;
  declare defaultMode: BlockMode;

  /**
   * Whether result will always be the same when inputs are same,
   * and function doesn't emit any value.
   */
  isPure: boolean;

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
  run(): unknown {
    return;
  }

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

export abstract class PureFunction<T extends FunctionData = FunctionData> extends BaseFunction<T> {
  isPure = true;
  cleanup(): void {
    this._data.output(undefined);
  }
}

export abstract class StatefulFunction extends BaseFunction<Block> {
  initInputs() {
    let inputMap = this.getInputMap();
    if (inputMap) {
      for (let [key, callback] of inputMap) {
        callback.call(this, this._data.getValue(key));
      }
    }
  }

  getInputMap(): Map<string, (this: StatefulFunction, val: unknown) => boolean> {
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
