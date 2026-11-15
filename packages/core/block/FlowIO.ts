import {Block} from './Block.ts';
import {BlockBindingSource, BlockConfig, BlockIO, BlockProperty} from './BlockProperty.ts';
import {ConfigGenerators, ConstTypeConfig} from './BlockConfigs.ts';
import {Task} from './Task.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {BlockOrder} from './BlockOrder.ts';
import {isRelativeProjectFilePath, resolveSubflowFilePath} from '../storage/FilePath.ts';

class InputOrderConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const owner = this._bindingSource?.getProperty()?._block;
    return super.onChange(owner ? BlockOrder.from(owner, value) : value, save);
  }
}

class InputCustomConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const changed = super.onChange(value, save);
    if (changed) {
      (this._block as InputsBlock)._updateFilePathProps(value);
    }
    return changed;
  }
}

class InputsBlockIO extends BlockIO {
  onChange(value: unknown, save?: boolean): boolean {
    const block = this._block as InputsBlock;
    if (block._filePathProps !== null) {
      value = block._resolveBoundFilePath(this._name, value, this._bindingSource);
    }
    return super.onChange(value, save);
  }
}

class InputsBlockConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const block = this._block as InputsBlock;
    if (block._filePathProps !== null) {
      value = block._resolveBoundFilePath(this._name, value, this._bindingSource);
    }
    return super.onChange(value, save);
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
  '#custom': InputCustomConfig,
};

export const OutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:outputs'),
  '#call': BlockProperty, // call not allowed
  '#return': BlockIO,
  '#wait': BlockOutputWaitingConfig, // directly forward wait to parent flow
};

export class InputsBlock extends Block {
  _filePathProps: Set<string> | null = null;

  _createIO(field: string): BlockProperty {
    return new InputsBlockIO(this, field);
  }

  _createConfig(field: string): BlockProperty {
    if (field in InputsConfigGenerators) {
      return new InputsConfigGenerators[field](this, field);
    } else {
      return new InputsBlockConfig(this, field);
    }
  }

  _updateFilePathProps(customList: unknown) {
    const prev = this._filePathProps;
    let next: Set<string> | null = null;
    if (Array.isArray(customList)) {
      for (const item of customList) {
        if (item && typeof item === 'object' && item.type === 'file-path' && typeof item.name === 'string') {
          next ??= new Set();
          next.add(item.name);
        }
      }
    }
    this._filePathProps = next;
    if (prev !== null || next !== null) {
      for (const [name, prop] of this._props) {
        if (prop._bindingSource && Boolean(prev?.has(name)) !== Boolean(next?.has(name))) {
          const source = prop._bindingSource.getProperty();
          prop.onChange(source ? source.getValue() : prop._bindingSource.getValue());
        }
      }
    }
  }

  _resolveBoundFilePath(name: string, value: unknown, bindingSource: BlockBindingSource): unknown {
    if (this._filePathProps?.has(name) && bindingSource && typeof value === 'string' && value.length > 0) {
      return resolveSubflowFilePath(value, bindingSource.getProperty()?._block._flow._library, this._flow._library);
    }
    return value;
  }

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
        const filePathProps = this._filePathProps;
        const outerLibrary = filePathProps !== null ? this._flow._parent?._flow?._library : undefined;
        const subLibrary = outerLibrary ? this._flow._library : undefined;
        const needFilePathResolve = Boolean(outerLibrary && subLibrary && outerLibrary !== subLibrary);
        for (const customProp of customList) {
          const name = customProp.name;
          let value = (val as DataMap)[name];
          if (name === '#order') {
            const property = this.getProperty('#order');
            property._bindingSource?.unlisten(property);
            property._bindingSource = null;
            value = BlockOrder.from(val as DataMap, value);
          } else if (filePathProps?.has(name)) {
            const property = this._props.get(name);
            if (property?._bindingSource) {
              property._bindingSource.unlisten(property);
              property._bindingSource = null;
            }
            if (
              needFilePathResolve &&
              typeof value === 'string' &&
              value.length > 0 &&
              isRelativeProjectFilePath(value)
            ) {
              value = `${outerLibrary}/${value}`;
            }
          }
          this.updateValue(name, value);
        }
      }
    }
  }
}

export class OutputsBlock extends Block {
  inputChanged(input: BlockIO, val: unknown) {
    super.inputChanged(input, val);
    this._flow.outputChanged(input, val);
  }

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
