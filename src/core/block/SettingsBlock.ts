import {Block} from './Block';
import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty';
import {ConstTypeConfig, FlowConfigGenerators} from './BlockConfigs';

const SettingsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  '#is': ConstTypeConfig('flow:settings'),
};

export class SettingsBlock extends Block {
  _createConfig(field: string): BlockProperty {
    if (field in SettingsConfigGenerators) {
      return new SettingsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}
// extends from BlockIO so it shows in the tree
class BlockSettingsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    let block = new SettingsBlock(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }
  setBinding(path: string) {
    // disable setBinding
  }
  onChange(val: unknown, save?: boolean): boolean {
    if (val instanceof SettingsBlock) {
      return super.onChange(val, save);
    }
    return false;
  }
}
export const GlobalConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:const'),
  '#settings': BlockSettingsConfig,
};
