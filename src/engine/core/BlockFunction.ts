import { BlockIO, BlockProperty } from "./BlockProperty";
import { FunctionDesc } from "./Descriptor";
import { BlockMode } from "./Block";

export interface FunctionData {
  getValue(field: string): any;

  updateValue(field: string, val: any): void;

  // a simple way of calling updateValue('output', value)
  output(value: any): void;

  getLength(): number;

  // get the property when it's a block, otherwise return null
  getProperty(field: string): BlockProperty;

  // get a Object that allows script to direct access its field,
  getRawObject(): any;
}

export class BlockFunction {
  _data: FunctionData;
  className: string;
  priority: number;

  constructor(block: FunctionData) {
    this._data = block;
  }

  descriptor: FunctionDesc;

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }

  // return stream output
  call(): any {
    // to be overridden
  }

  checkInitRun(mode: BlockMode): boolean {
    return mode === 'auto';
  }

  blockCommand(command: string, params: { [key: string]: any }): void {
    // to be overridden
  }

  propCommand(command: string, field: string, params: { [key: string]: any }): void {
    // to be overridden
  }

  destroy(): void {
    // to be overridden
  }

}

BlockFunction.prototype.className = '';

BlockFunction.prototype.priority = 0;

BlockFunction.prototype.descriptor = {
  inputs: [], outputs: [], attributes: [],
};

export type FunctionGenerator = new (block: Object) => BlockFunction;
