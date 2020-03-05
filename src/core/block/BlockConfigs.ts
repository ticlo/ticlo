import {BlockIO, BlockProperty} from './BlockProperty';
import {Block, InputsBlock, OutputsBlock} from './Block';

class BlockTypeConfig extends BlockProperty {
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
    this._block._typeChanged(this._value);
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

export class BlockInputsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    let block = new InputsBlock(this._block._job, this._block, this);
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
    let block = new OutputsBlock(this._block._job, this._block, this);
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
    this._block._job.onWait(this._value);
  }
}

class BlockCancelConfig extends BlockProperty {
  _valueChanged() {
    this._block.onCancel(this._value);
  }
}

export class BlockConstConfig extends BlockProperty {
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

  onChange(val: any, save?: boolean): boolean {
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

class BlockInputTypeConfig extends BlockConstConfig {
  constructor(block: Block, name: string) {
    super(block, name, 'inputs');
  }

  _save(): any {
    // no need to save 'input'
    return '';
  }
}

class BlockOutputTypeConfig extends BlockConstConfig {
  constructor(block: Block, name: string) {
    super(block, name, 'outputs');
  }

  _save(): any {
    // no need to save 'output'
    return '';
  }
}

export const ConfigGenerators: {[key: string]: typeof BlockProperty} = {
  '#is': BlockTypeConfig,
  '#mode': BlockModeConfig,
  '#call': BlockCallConfig,
  '#sync': BlockSyncConfig,
  '#len': BlockLengthConfig,
  '#wait': BlockWaitingConfig,
  '#cancel': BlockCancelConfig,
  '#priority': BlockPriorityConfig
};

export const InputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': BlockInputTypeConfig,
  '#call': BlockProperty
};

export const OutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': BlockOutputTypeConfig,
  '#call': BlockProperty,
  '#wait': BlockOutputWaitingConfig // directly forward wait to parent job
};

export const JobConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#inputs': BlockInputsConfig,
  '#outputs': BlockOutputsConfig
};
