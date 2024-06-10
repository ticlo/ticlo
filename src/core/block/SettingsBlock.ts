import {Block} from './Block';
import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty';
import {BlockConstConfig, ConstTypeConfig, FlowConfigGenerators} from './BlockConfigs';
import type {Flow} from './Flow';
import {systemZone} from '../util/DateTime';
import {DataMap, isDataMap} from '../util/DataTypes';

class SettingProperty extends BlockProperty {
  setBinding(path: string) {
    // disable setBinding
  }
}

const SettingsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  '#is': ConstTypeConfig('flow:settings'),
};

export class SettingsBlock extends Block {
  constructor(flow: Flow, parent: Block, prop: BlockProperty) {
    super(flow, parent, prop);
    this._props.set('timezone', new BlockConstConfig(this, 'timezone', systemZone));
  }
  getProperty(field: string, create: boolean = true): BlockProperty {
    if (this._destroyed) {
      return super.getProperty(field, create);
    }
    let prop: BlockProperty = this._props.get(field);
    if (prop) {
      return prop;
    }

    let firstChar = field.charCodeAt(0);

    if (firstChar === 35 || firstChar === 94 || firstChar === 126 || firstChar === 64) {
      return super.getProperty(field, create);
    }
    prop = new SettingProperty(this, field);
    this._props.set(field, prop);
    return prop;
  }
  _createConfig(field: string): BlockProperty {
    if (field in SettingsConfigGenerators) {
      return new SettingsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
  _preLoad(map: unknown) {
    // this is called during loadGlobal
    if (isDataMap(map)) {
      super._load(map);
    }
  }
  _load(map: DataMap) {
    // skip the normal loading
    return;
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
    if (save && val instanceof SettingsBlock) {
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
