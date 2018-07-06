import {BlockIO, BlockProperty, Block$Property} from "./BlockProperty";
import {FunctionDesc} from "./Descriptor";
import {BlockMode} from "./Block";
import {Event} from "./Event";

export interface FunctionOutput {
  // field is 'output' by default
  output(value: any, field?: string): void;

  // dispatch a update event after async operation
  emit(event?: any): void;
}

export interface FunctionInput {

  getValue(field: string): any;

  getLength(): number;
}

export interface FunctionData extends FunctionInput, FunctionOutput {

  // get the property when it's a block, otherwise return null
  getProperty(field: string, create: boolean): BlockProperty;

  // get a Object that allows script to direct access its field,
  getRawObject(): any;
}

export class BlockFunction {
  _data: FunctionData;
  className: string;
  priority: number;
  defaultMode: BlockMode;

  constructor(block: FunctionData) {
    this._data = block;
  }

  descriptor: FunctionDesc;

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }

  // return true when it needs to be put in queue
  input$Changed(input: Block$Property, val: any): boolean {
    return false;
  }


  // return stream output
  run(data: FunctionData): any {
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
    // to be overridden
  }

}

BlockFunction.prototype.priority = 0;
BlockFunction.prototype.defaultMode = 'always';
BlockFunction.prototype.descriptor = {
  inputs: [], outputs: [], attributes: [],
};

export type FunctionGenerator = new (block: FunctionData) => BlockFunction;
