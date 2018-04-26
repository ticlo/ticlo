import { Block } from "./Block";
import { BlockProperty } from "./BlockProperty";

export class BlockClassControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {

    this._block._classChanged(this._value);
  }
}

export class BlockCallControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {
    this._block._onCall(this._value);
  }
}

export class BlockModeControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {
    this._block._modeChanged(this._value);
  }
}

export class BlockLengthControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {
    this._block._lengthChanged(this._value);
  }
}

export class BlockPriorityControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {
    this._block._priorityChanged(this._value);
  }
}
