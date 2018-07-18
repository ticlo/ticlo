import {BlockIO, BlockProperty} from "./BlockProperty";
import {FunctionDesc} from "./Descriptor";
import {BlockMode, Block} from "./Block";
import {Event} from "./Event";

export interface FunctionOutput {
  // field is 'output' by default
  output(value: any, field?: string): void;

  // notify the output if function is waiting for callback
  // when waiting state is false, emit will be output to the #emit config
  wait(val: any, emit?: any): void;
}

export interface FunctionInput {

  getValue(field: string): any;

  getLength(): number;
}

export interface FunctionData extends FunctionInput, FunctionOutput {

  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;

}

export class BlockFunction {
  _data: Block;
  className: string;
  priority: number;
  defaultMode: BlockMode;

  constructor(block?: Block) {
    this._data = block;
  }

  descriptor: FunctionDesc;

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }

  // return stream output
  run(): any {
    // to be overridden
  }

  // cancel any async operation
  cancel(): void {
    // to be overridden
  }

  blockCommand(command: string, params: {[key: string]: any}): void {
    // to be overridden
  }

  destroy(): void {
    this._data = undefined;
  }

}

BlockFunction.prototype.priority = 0;
BlockFunction.prototype.defaultMode = 'always';
BlockFunction.prototype.descriptor = {
  inputs: [], outputs: [], attributes: [],
};

export type FunctionGenerator = new (block: FunctionData) => BlockFunction;
