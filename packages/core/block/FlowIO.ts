import {Block} from './Block.ts';
import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty.ts';
import {ConfigGenerators, ConstTypeConfig} from './BlockConfigs.ts';
import {Task} from './Task.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {BlockOrder} from './BlockOrder.ts';

class InputOrderConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const owner = this._bindingSource?.getProperty()?._block;
    return super.onChange(owner ? BlockOrder.from(owner, value) : value, save);
  }
}

class BlockOutputWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block._flow.onWait(this._value);
  }
}

export const InputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:inputs'),
  '#call': BlockProperty,
  '#order': InputOrderConfig,
};

export const OutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:outputs'),
  '#call': BlockProperty, // call not allowed
  '#return': BlockIO,
  '#wait': BlockOutputWaitingConfig, // directly forward wait to parent flow
};

export class InputsBlock extends Block {
  _createConfig(field: string): BlockProperty {
    if (field in InputsConfigGenerators) {
      return new InputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  // REFACTOR(design.md): MUST deliver worker inputs as transient port events unless the function declares retention.
  _setInputValue(val: unknown) {
    if (val instanceof Task) {
      this.updateValue('#value', val.getData());
      val = val.getDataMap();
    } else {
      this.updateValue('#value', val);
    }
    if (val instanceof Block) {
      const customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        for (const customProp of customList) {
          // create raw binding
          this.getProperty(customProp.name)._listenRaw(val.getProperty(customProp.name));
        }
      }
    } else if (Object.isExtensible(val)) {
      const customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        for (const customProp of customList) {
          const value = (val as DataMap)[customProp.name];
          if (customProp.name === '#order') {
            const property = this.getProperty('#order');
            property._bindingSource?.unlisten(property);
            property._bindingSource = null;
          }
          this.updateValue(
            customProp.name,
            customProp.name === '#order' ? BlockOrder.from(val as DataMap, value) : value
          );
        }
      }
    }
  }
}

export class OutputsBlock extends Block {
  // REFACTOR(design.md): MUST forward each worker output delivery without caching it as a property value.
  inputChanged(input: BlockIO, val: unknown) {
    super.inputChanged(input, val);
    this._flow.outputChanged(input, val);
  }

  // REFACTOR(design.md): MUST keep configuration updates distinct from transient output deliveries.
  configChanged(input: BlockConfig, val: unknown) {
    super.configChanged(input, val);
    switch (input._name) {
      case '#custom':
        break;
      default:
        this._flow.outputChanged(input, val);
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in OutputsConfigGenerators) {
      return new OutputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}
