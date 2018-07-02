import { Job } from "./Job";
import { Block } from "./Block";
import { BlockProperty } from "./BlockProperty";

export class BlockClassControl extends BlockProperty {

  _savedRaw: any = null;

  get _saved(): any {
    return this._savedRaw;
  }

  set _saved(val: any) {
    if (val === undefined) {
      this._savedRaw = null;
    } else {
      this._savedRaw = val;
    }
  }

  _valueChanged() {
    this._block._classChanged(this._value);
  }
}

export class BlockCallControl extends BlockProperty {
  _valueChanged() {
    this._block._onCall(this._value);
  }
}

export class BlockSyncControl extends BlockProperty {
  _valueChanged() {
    this._block._syncChanged(this._value);
  }
}

export class BlockModeControl extends BlockProperty {
  _valueChanged() {
    this._block._modeChanged(this._value);
  }
}

export class BlockLengthControl extends BlockProperty {
  _valueChanged() {
    this._block._lengthChanged(this._value);
  }
}

export class BlockPriorityControl extends BlockProperty {
  _valueChanged() {
    this._block._priorityChanged(this._value);
  }
}

export class BlockInputControl extends BlockProperty {
}

export class BlockOutputControl extends BlockProperty {
}

export class BlockDoneControl extends BlockProperty {
  _valueChanged() {
    if (this._block instanceof Job) {
      this._block.onDone(this._value);
    }
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
