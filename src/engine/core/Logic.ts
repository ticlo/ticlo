import {Block} from "Block"
import {BlockProperty} from "BlockProperty"
import {LogicDesc} from "Descriptor"
import {IDestroyable} from "Dispatcher"


export class Logic implements IDestroyable {
  _block: Block;
  type: string;
  priority: number;
  initRun: boolean;

  constructor(block: Block) {
    this._block = block;
  }

  descriptor: LogicDesc;

  // return true when it needs to be put in queue
  inputChanged(input: BlockProperty, val: any): boolean {
    return true;
  };

  // return stream output
  run(val: any): any {
    // example
  };

  checkInitRun(): boolean {
    return true;
  };

  checkInitTrigger(loading: boolean): void {

  };

  blockCommand(command: string, params: Object): void {

  }

  propCommand(command: string, field: string, params: Object): void {

  }

  destroy(): void {
  };


}

Logic.prototype.type = '';

Logic.prototype.priority = 0;

Logic.prototype.descriptor = {
  'inputs': [],
  'outputs': [],
  'attributes': [],
};

/**
 * whether the logic should be run right after it's created
 */
Logic.prototype.initRun = false;

export type LogicType = new (block: Block) => Logic;
