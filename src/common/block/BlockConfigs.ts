import {Block} from "./Block";
import {BlockProperty} from "./BlockProperty";

export class BlockClassConfig extends BlockProperty {

  constructor(block: Block, name: string) {
    super(block, name);
    this._value = '';
    this._saved = '';
  }

  onChange(val: any, save?: boolean): boolean {
    if (val == null) {
      return super.onChange('', save);
    } else {
      return super.onChange(val, save);
    }
  }

  _valueChanged() {
    this._block._classChanged(this._value);
  }
}

export class BlockCallConfig extends BlockProperty {
  _valueChanged() {
    this._block._onCall(this._value);
  }
}

export class BlockSyncConfig extends BlockProperty {
  _valueChanged() {
    this._block._syncChanged(this._value);
  }
}

export class BlockModeConfig extends BlockProperty {
  _valueChanged() {
    this._block._modeChanged(this._value);
  }
}

export class BlockLengthConfig extends BlockProperty {
  _valueChanged() {
    this._block._lengthChanged(this._value);
  }
}

export class BlockPriorityConfig extends BlockProperty {
  _valueChanged() {
    this._block._priorityChanged(this._value);
  }
}

export class BlockInputConfig extends BlockProperty {
}

export class BlockOutputConfig extends BlockProperty {
}

export class BlockWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block.onWait(this._value);
  }
}

export class BlockCancelConfig extends BlockProperty {
  _valueChanged() {
    this._block.onCancel(this._value);
  }
}

export class BlockReadOnlyConfig extends BlockProperty {
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
