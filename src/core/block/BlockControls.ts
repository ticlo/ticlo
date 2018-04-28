import { Block } from "./Block";
import { BlockProperty } from "./BlockProperty";
import { Listener } from "./Dispatcher";

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


export class BlockReadOnlyControl extends BlockProperty {
  constructor(block: Block, name: string, value?: any) {
    super(block, name);
    this._value = value;
  }

  updateValue(val: any): boolean {
    // disable updateValue
    return false;
  }

  setValue(val: any) {
    // disable setValue
  }

  setBinding(path: string) {
    // disable setBinding
  }

  // unlisten(listener: Listener) {
  //   super.unlisten(listener);
  //   if (this._listeners.size === 0) {
  //     delete this._block._props[this._name];
  //     this.destroy();
  //   }
  // }
}