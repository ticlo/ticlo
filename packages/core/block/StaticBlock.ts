import './Block.ts';
import {Block, OutputsBlock} from './Block.ts';
import {BlockConfig, BlockProperty} from './BlockProperty.ts';
import {DataMap, isSavedBlock} from '../util/DataTypes.ts';
import {ConfigGenerators, ConstTypeConfig, FlowConfigGenerators} from './BlockConfigs.ts';
import {Flow} from './Flow.ts';
import {encodeTicloName} from '../util/Name.ts';
import {FunctionDispatcher} from './FunctionLib.ts';
import {FunctionFactory} from './BlockFunction.ts';
import {PropListener} from './Dispatcher.ts';
import {Namespace} from './Namespace.ts';

export class StaticConfig extends BlockProperty {
  _load(val: unknown) {}

  _liveUpdate(val: unknown) {
    if (isSavedBlock(val)) {
      if (this._value instanceof StaticBlock) {
        this._value._liveUpdate(val);
      }
    }
  }
  _liveClear() {
    if (this._value instanceof StaticBlock) {
      this._value._liveUpdate({});
    }
  }

  _saveValue(): unknown {
    if (this._value instanceof StaticBlock) {
      const result = this._value.save();
      // check if StaticBlock is needed even with no child block
      if ('#cacheMode' in result || '#custom' in result) {
        return result;
      }
      // check if there is a child block
      for (const key in result) {
        if (isSavedBlock(result[key])) {
          return result;
        }
      }
    }
    return undefined;
  }
}

export const StaticBlockConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:static'),
};

export const SharedBlockConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:const'),
};

// The function library's flow owns this runtime-only #shared container.
class SharedBlock extends Block {
  _createConfig(field: string): BlockProperty {
    if (field in SharedBlockConfigGenerators) {
      return new SharedBlockConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}

// One function's static content, owned by #shared and referenced through #static.
export class StaticBlock extends Block {
  static _dict = new Map<any, StaticBlock>();
  static loadStaticBlock(flow: FlowWithStatic, funcId: string, data: DataMap) {
    const cacheKey = flow.getCacheKey(funcId, data);
    if (!cacheKey) {
      return null;
    }
    const staticBlock = StaticBlock._loadFuncStaticBlock(flow, cacheKey, data);
    flow._setStaticBlock(staticBlock);
    return staticBlock;
  }

  static _loadFuncStaticBlock(flow: FlowWithStatic, funcId: string, data: DataMap) {
    const functions = Namespace.getFunctions(funcId, flow);
    const libraryFlow = functions?.flow;
    if (!libraryFlow) {
      return null;
    }
    const sharedProp = libraryFlow.getProperty('#shared', true);
    let sharedBlock = sharedProp._value;
    if (!(sharedBlock instanceof SharedBlock) || sharedBlock._prop !== sharedProp) {
      sharedBlock = new SharedBlock(libraryFlow, libraryFlow, sharedProp);
      sharedProp.setValue(sharedBlock);
    }
    const getLocalId = (functions as unknown as {getLocalId?: (id: string) => string}).getLocalId;
    const localId = getLocalId ? getLocalId.call(functions, funcId) : funcId;
    const prop = sharedBlock.getProperty(encodeTicloName(localId));
    if (StaticBlock._dict.has(prop)) {
      return StaticBlock._dict.get(prop);
    } else {
      const staticBlock = new StaticBlock(prop._block._flow, prop._block, prop);
      staticBlock._funcDispatcher = functions.listen(funcId, staticBlock._funcListener);
      staticBlock._cacheKey = prop;
      StaticBlock._dict.set(prop, staticBlock);
      prop.setValue(staticBlock);
      staticBlock._load(data);
      return staticBlock;
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in StaticBlockConfigGenerators) {
      return new StaticBlockConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _funcDispatcher: FunctionDispatcher;
  _funcListener: PropListener<FunctionFactory | null> = {
    onSourceChange(prop: unknown) {},
    onChange: (val: FunctionFactory | null) => {
      // _source is set after listener is attached, so the first change will be skipped
      if (this._cacheKey != null) {
        // force detach when the owning function changes or is deleted
        this._flows.clear();
        this.clearStaticBlock();
      }
    },
  };
  _cacheKey: unknown;
  _flows = new Set<Flow>();
  attachFlow(flow: Flow) {
    this._flows.add(flow);
  }
  detachFlow(flow: Flow) {
    this._flows.delete(flow);
  }
  clearStaticBlock() {
    if (this._prop._value === this) {
      this._prop.setValue(undefined);
    }
  }
  save(): DataMap {
    return this._save();
  }

  destroy(): void {
    if (this._funcDispatcher) {
      this._funcDispatcher.unlisten(this._funcListener);
    }
    if (this._cacheKey && StaticBlock._dict.get(this._cacheKey) === this) {
      StaticBlock._dict.delete(this._cacheKey);
    }
    super.destroy();
  }
}

export const FlowWithStaticConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#static': StaticConfig,
};

// Worker and editor flows expose the library-owned StaticBlock through #static.
export class FlowWithStatic extends Flow {
  _staticBlock: StaticBlock;

  save(): DataMap {
    const data = super.save();
    const main = this._props.get('#main');
    const outputs = data['#outputs'] as DataMap;
    if (
      main?._saved instanceof Block &&
      main._saved._prop === main &&
      this._props.get('#outputs')?._saved instanceof OutputsBlock &&
      outputs &&
      !Object.hasOwn(outputs, '#main') &&
      !Object.hasOwn(outputs, '~#main')
    ) {
      outputs['~#main'] = '##.#main';
      const custom = outputs['#custom'];
      if (!Array.isArray(custom) || !custom.some((prop) => prop.name === '#main')) {
        outputs['#custom'] = [...(Array.isArray(custom) ? custom : []), {name: '#main', type: 'block'}];
      }
    }
    return data;
  }

  getCacheKey(funcId: string, data: DataMap): string | null {
    return funcId || null;
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowWithStaticConfigGenerators) {
      return new FlowWithStaticConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _loadFlowData(map: DataMap, funcId?: string) {
    if (funcId && isSavedBlock(map['#static'])) {
      // #static is loaded before normal flow data so bindings inside the main
      // flow can immediately resolve paths that cross into the static block.
      StaticBlock.loadStaticBlock(this, funcId, map['#static']);
    }
    super._load(map);
  }
  _setStaticBlock(block: StaticBlock) {
    if (block === this._staticBlock) {
      return;
    }
    if (this._staticBlock) {
      this._staticBlock.detachFlow(this);
    }
    this._staticBlock = block;
    if (block) {
      this._staticBlock.attachFlow(this);
    }
    this.updateValue('#static', block);
  }
  destroy(): void {
    if (this._staticBlock) {
      this._staticBlock.detachFlow(this);
      this._staticBlock = null;
    }
    super.destroy();
  }
}
