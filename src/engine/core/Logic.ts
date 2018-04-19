import { BlockIO, BlockProperty } from "./BlockProperty";
import { LogicDesc } from "./Descriptor";
import { BlockMode } from "./Block";

export interface LogicData {
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

export class Logic {
  _data: LogicData;
  className: string;
  priority: number;

  constructor(block: LogicData) {
    this._data = block;
  }

  descriptor: LogicDesc;

  // return true when it needs to be put in queue
  inputChanged(input: BlockIO, val: any): boolean {
    return true;
  }

  // return stream output
  run(): any {
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

Logic.prototype.className = '';

Logic.prototype.priority = 0;

Logic.prototype.descriptor = {
  inputs: [], outputs: [], attributes: [],
};

export type LogicGenerator = new (block: Object) => Logic;
