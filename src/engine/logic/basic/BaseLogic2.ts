import {Logic} from "../../core/Logic"
import {BlockIO} from "../../core/BlockProperty"
import {Block} from "../../core/Block"

export class BaseLogic2 extends Logic {
  _input0: BlockIO;
  _input1: BlockIO;
  _out: BlockIO;

  constructor(block: Block) {
    super(block);
    // cache properties
    this._input0 = block.getProp('0') as BlockIO;
    this._input1 = block.getProp('1') as BlockIO;
    this._out = block.getProp('#>');
  }

  checkInitRun(): boolean {
    return this._input0._value != null || this._input1._value != null;
  };

}

BaseLogic2.prototype.priority = 0;
BaseLogic2.prototype.descriptor = {
  'inputs': [
    {'name': '0', 'type': 'number'},
    {'name': '1', 'type': 'number'}
  ],
  'outputs': [
    {'name': 'out', 'type': 'number'}
  ],
};
