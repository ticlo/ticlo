import {BlockIO} from "./BlockProperty";
import {LogicDesc} from "./Descriptor";
import {BlockMode} from "./Block";

export interface LogicData {
  output(value: any): void;

  getValue(field: string): any;

  updateValue(field: string, val: any): void;
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

  checkInitTrigger(loading: boolean): void {
    // to be overridden
  }

  blockCommand(command: string, params: Object): void {
    // to be overridden
  }

  propCommand(command: string, field: string, params: Object): void {
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
