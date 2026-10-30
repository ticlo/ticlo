import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty.ts';
import {type Block} from './Block.ts';
import {EventType} from './Event.ts';
import {BlockMode} from './Descriptor.ts';
import {type FunctionData} from './FunctonData.ts';
import type {DataMap} from '../util/DataTypes.ts';
import type {FunctionDesc} from './Descriptor.ts';

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

  // REFACTOR(design.md): MUST admit calls as transient events in the deterministic delivery queue.
  onCall(val: unknown): boolean {
    return val !== undefined;
  }

  // return true when it needs to be put in queue
  // REFACTOR(design.md): MUST handle an input delivery without relying on an implicitly cached latest input.
  inputChanged(input: BlockIO, val: unknown): boolean {
    return true;
  }
  // return true when it needs to be put in queue
  configChanged(config: BlockConfig, val: unknown): boolean {
    return false;
  }

  // return stream output
  // REFACTOR(design.md): MUST return or emit transient deliveries and keep prior values only in declared state.
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
  // REFACTOR(design.md): MUST cancel owned async deliveries and release their retained payloads.
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto'): boolean {
    return true;
  }

  // cleanup when function is destroyed but data needs to be reused
  cleanup(): void {}
  // destroy the function, any change applied to _data will be handled in cleanup()
  // REFACTOR(design.md): MUST prevent late emissions and release explicit state when removing this function.
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
  // REFACTOR(design.md): Cleanup MUST release explicit state; outputs MUST NOT require clearing a cached value.
  cleanup(): void {
    this._data.output(undefined);
  }
}

export abstract class StatefulFunction extends BaseFunction<Block> {
  // REFACTOR(design.md): MUST initialize only explicitly declared retained state, not previous transient inputs.
  initInputs() {
    const inputMap = this.getInputMap();
    if (inputMap) {
      for (const [key, callback] of inputMap) {
        callback.call(this, this._data.getValue(key));
      }
    }
  }

  getInputMap(): Map<string, (this: StatefulFunction, val: unknown) => boolean> {
    return null;
  }

  // return true when it needs to be put in queue
  // REFACTOR(design.md): MUST transfer event data only into state that the function declares.
  inputChanged(input: BlockIO, val: unknown): boolean {
    const inputMap = this.getInputMap();
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

export type FunctionClass = (new (block: FunctionData) => BaseFunction) & {
  save?: () => DataMap;
  equals?: (data: DataMap) => boolean;
  ticlWorkerData?: DataMap;
};

export interface FunctionFactory {
  cls?: FunctionClass | null;
  create: (block: FunctionData) => BaseFunction | null;
  desc: FunctionDesc;
  functionApi?: FunctionApi;
  meta: Record<string, any>;
  getMeta(key: string): any;
  save?: () => DataMap;
  equals?: (data: DataMap) => boolean;
  ticlWorkerData?: DataMap;
}

export interface FunctionApi {
  getDefaultWorker?(block: Block, field: string, blockStack: Map<any, any>): DataMap;
  /** Commands must skip writes when readonly is true, including property-specific commands. */
  commands?: {
    [key: string]: (block: Block, params: {[key: string]: unknown; property?: string}, readonly: boolean) => unknown;
  };
}

export interface FunctionFactoryOptions {
  meta?: Record<string, any>;
  save?: () => DataMap;
  equals?: (data: DataMap) => boolean;
  ticlWorkerData?: DataMap;
}

export function createFunctionFactory(
  cls: FunctionClass | null,
  desc: FunctionDesc,
  options?: FunctionFactoryOptions
): FunctionFactory {
  const meta = options?.meta ?? {};
  return {
    cls,
    create: cls ? (block: FunctionData) => new cls(block) : () => null,
    desc,
    meta,
    getMeta(key: string) {
      return this.meta?.[key];
    },
    save: options?.save ?? cls?.save,
    equals: options?.equals ?? cls?.equals,
    ticlWorkerData: options?.ticlWorkerData ?? cls?.ticlWorkerData,
  };
}
