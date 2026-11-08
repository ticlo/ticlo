import {InputsBlock, OutputsBlock} from './FlowIO.ts';
import type {Block} from './Block.ts';
import {BlockIO, BlockProperty} from './BlockProperty.ts';
import {BlockConstConfig, ConfigGenerators, ConstTypeConfig} from './BlockConfigs.ts';
import type {Flow} from './Flow.ts';
import {FlowFunctionModule} from './LibraryFunctionModule.ts';
import {isDataMap} from '../util/DataTypes.ts';

export class BlockInputsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    const block = new InputsBlock(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }
}
// extends from BlockIO so it shows in the tree
export class BlockOutputsConfig extends BlockIO {
  createBlock(save: boolean): Block {
    const block = new OutputsBlock(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }
}

export class BlockFunctionsConfig extends BlockProperty {
  // REFACTOR(design.md): MUST migrate worker definitions without changing existing block function types in place.
  onChange(val: unknown, save?: boolean): boolean {
    const funcModule = (this._block as Flow).getFuncModule() as FlowFunctionModule;
    if (isDataMap(val)) {
      funcModule.load(val);
    } else {
      funcModule.load({});
    }

    return super.onChange(val, save);
  }

  _saveValue(): unknown {
    if (
      (this._block as Flow)._funcModule instanceof FlowFunctionModule &&
      ((this._block as Flow)._funcModule as FlowFunctionModule).flow === this._block
    ) {
      return ((this._block as Flow)._funcModule as FlowFunctionModule).save();
    }
    return undefined;
  }

  _liveClear() {
    ((this._block as Flow).getFuncModule() as FlowFunctionModule).load({});
    super._liveClear();
  }
}

export const FlowConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:main'),
  '#inputs': BlockInputsConfig,
  '#outputs': BlockOutputsConfig,
  '#main': BlockIO,
  '#functions': BlockFunctionsConfig,
  '#shared': BlockConstConfig,
};

export const FlowFolderConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:folder'),
};
export const FlowLibraryConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:library'),
};
export const GlobalConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:global'),
};
export const FlowModuleConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:module'),
};
