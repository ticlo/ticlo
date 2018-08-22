import {Block} from "./Block";
import {BlockProperty} from "./BlockProperty";
import {BaseFunction, FunctionData} from "./BlockFunction";

class BlockClassConfig extends BlockProperty {

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

class BlockCallConfig extends BlockProperty {
  _valueChanged() {
    this._block._onCall(this._value);
  }
}

class BlockSyncConfig extends BlockProperty {
  _valueChanged() {
    this._block._syncChanged(this._value);
  }
}

class BlockModeConfig extends BlockProperty {
  _valueChanged() {
    this._block._modeChanged(this._value);
  }
}

class BlockLengthConfig extends BlockProperty {
  _valueChanged() {
    this._block._lengthChanged(this._value);
  }
}

class BlockPriorityConfig extends BlockProperty {
  _valueChanged() {
    this._block._priorityChanged(this._value);
  }
}

class BlockInputConfig extends BlockProperty {
}

class BlockOutputConfig extends BlockProperty {
}

class BlockWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block.onWait(this._value);
  }
}

class BlockCancelConfig extends BlockProperty {
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
  //     delete this._block._props.get(this._name);
  //     this.destroy();
  //   }
  // }
}


export const ConfigGenerators: {[key: string]: new (block: Block, field: string) => BlockProperty} = {
  '#is': BlockClassConfig,
  '#mode': BlockModeConfig,
  '#call': BlockCallConfig,
  '#sync': BlockSyncConfig,
  '#length': BlockLengthConfig,
  '#input': BlockInputConfig,
  '#output': BlockOutputConfig,
  '#waiting': BlockWaitingConfig,
  '#cancel': BlockCancelConfig,
  '#priority': BlockPriorityConfig,
};
