import {BlockIO, BlockProperty} from './BlockProperty';
import {Block, InputsBlock, OutputsBlock} from './Block';

class BlockFuncIdConfig extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
    this._value = '';
    this._saved = '';
  }

  onChange(val: unknown, save?: boolean): boolean {
    if (typeof val === 'string' && !val.startsWith('flow:')) {
      return super.onChange(val, save);
    } else {
      return super.onChange('', save);
    }
  }

  _valueChanged() {
    this._block._funcidChanged(this._value);
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

class BlockDisabledConfig extends BlockProperty {
  _valueChanged() {
    this._block._disabledChanged(this._value);
  }
}

class BlockPriorityConfig extends BlockProperty {
  _valueChanged() {
    this._block._priorityChanged(this._value);
  }
}

export class BlockInputsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    let block = new InputsBlock(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }
}

export class BlockOutputsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    let block = new OutputsBlock(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }
}

class BlockWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block.onWait(this._value);
  }
}

class BlockOutputWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block._flow.onWait(this._value);
  }
}

class BlockCancelConfig extends BlockProperty {
  _valueChanged() {
    this._block.onCancel(this._value);
  }
}

export class BlockConstConfig extends BlockProperty {
  constructor(block: Block, name: string, value?: unknown) {
    super(block, name);
    this._value = value;
  }

  updateValue(val: unknown): boolean {
    // disable updateValue
    return false;
  }

  setValue(val: unknown) {
    // disable setValue
  }

  setBinding(path: string) {
    // disable setBinding
  }

  onChange(val: unknown, save?: boolean): boolean {
    return false;
  }

  // unlisten(listener: Listener) {
  //   super.unlisten(listener);
  //   if (this._listeners.size === 0) {
  //     this._block._props.delete(this._name);
  //     this.destroy();
  //   }
  // }
}

export function ConstTypeConfig(type: string): typeof BlockProperty {
  class BlockConstTypeConfig extends BlockConstConfig {
    constructor(block: Block, name: string) {
      super(block, name, type);
    }
    _saveValue(): unknown {
      // no need to save const types
      return '';
    }
  }
  return BlockConstTypeConfig;
}

export const ConfigGenerators: {[key: string]: typeof BlockProperty} = {
  '#is': BlockFuncIdConfig,
  '#disabled': BlockDisabledConfig,
  '#mode': BlockModeConfig,
  '#call': BlockCallConfig,
  '#sync': BlockSyncConfig,
  '#wait': BlockWaitingConfig,
  '#cancel': BlockCancelConfig,
  '#priority': BlockPriorityConfig,
};

export const InputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:inputs'),
  '#call': BlockProperty,
};

export const OutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:outputs'),
  '#call': BlockProperty,
  '#value': BlockIO,
  '#wait': BlockOutputWaitingConfig, // directly forward wait to parent flow
};

export const FlowConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:main'),
  '#inputs': BlockInputsConfig,
  '#outputs': BlockOutputsConfig,
};
