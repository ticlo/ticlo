import {Logic} from "../../core/Logic"
import {BlockControl, BlockIO} from "../../core/BlockProperty"
import {Block} from "../../core/Block"

export class BaseLogicN extends Logic {
  _size: BlockIO;
  _out: BlockIO;

  constructor(block: Block) {
    super(block);
    this._size = block.getProp('#size') as BlockControl;
    this._out = block.getProp('out');
  }

  checkInitRun(): boolean {
    return this._size._value > 0;
  }
}

BaseLogicN.prototype.priority = 0;
BaseLogicN.prototype.descriptor = {
  'inputs': [
    {
      'group': 'input', 'type': 'group', 'size': '#size',
      'fields': [
        {'name': '', 'type': 'number'}
      ]
    }
  ],
  'outputs': [
    {'name': 'out', 'type': 'number'}
  ],
};

