import './Block.js';
import {BlockConfig, BlockProperty} from './BlockProperty.js';
import {DataMap, isSavedBlock} from '../util/DataTypes.js';
import {ConstTypeConfig, FlowConfigGenerators} from './BlockConfigs.js';
import {Flow, Root} from './Flow.js';
import {Uid} from '../util/Uid.js';
import {encodeTicloName} from '../util/Name.js';
import {FunctionDispatcher, Functions} from './Functions.js';
import {FunctionClass} from './BlockFunction.js';
import {PropListener} from './Dispatcher.js';

export class SharedConfig extends BlockProperty {
  _load(val: unknown) {}

  _liveUpdate(val: unknown) {
    if (isSavedBlock(val)) {
      if (this._value instanceof SharedBlock) {
        this._value._liveUpdate(val);
      }
    }
  }
  _liveClear() {
    if (this._value instanceof SharedBlock) {
      this._value._liveUpdate({});
    }
  }

  _saveValue(): unknown {
    if (this._value instanceof SharedBlock) {
      const result = this._value.save();
      // check if SharedBlock is needed even with no child block
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

export const SharedBlockConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:shared'),
};

export class SharedBlock extends Flow {
  static uid = new Uid();
  static _dict = new Map<any, SharedBlock>();
  static loadSharedBlock(flow: FlowWithShared, funcId: string, data: DataMap) {
    const cacheKey = flow.getCacheKey(funcId, data);
    let sharedBlock: SharedBlock;
    if (typeof cacheKey === 'string') {
      sharedBlock = SharedBlock._loadFuncSharedBlock(flow, cacheKey, data);
    } else {
      sharedBlock = SharedBlock._loadSharedBlock(flow, funcId, data, cacheKey);
    }
    flow._setSharedBlock(sharedBlock);
    return sharedBlock;
  }

  static _loadFuncSharedBlock(flow: FlowWithShared, funcId: string, data: DataMap) {
    if (SharedBlock._dict.has(funcId)) {
      return SharedBlock._dict.get(funcId);
    } else {
      const sharedRoot = Root.instance._sharedRoot;
      const prop = sharedRoot.getProperty(encodeTicloName(funcId));
      const sharedBlock = new SharedBlock(sharedRoot, sharedRoot, prop);
      sharedBlock._funcDispatcher = Functions.listen(funcId, sharedBlock._funcListener);
      sharedBlock._cacheKey = funcId;
      sharedBlock._cacheMode = data['#cacheMode'];
      SharedBlock._dict.set(funcId, sharedBlock);
      prop.updateValue(sharedBlock);
      let sharedId;
      if (funcId.includes(':')) {
        sharedId = `${funcId}__shared`;
      }
      sharedBlock.load(data, sharedId);
      return sharedBlock;
    }
  }

  static _loadSharedBlock(flow: FlowWithShared, funcId: string, data: DataMap, cacheKey: unknown) {
    if (cacheKey && SharedBlock._dict.has(cacheKey)) {
      return SharedBlock._dict.get(cacheKey);
    } else {
      // find a property to store the shared block
      let prop: BlockProperty;
      if (cacheKey instanceof BlockProperty) {
        // usually used by repeater blocks
        prop = cacheKey;
      } else {
        // find a property from global sharedRoot
        const uid = SharedBlock.uid;
        const sharedRoot = Root.instance._sharedRoot;
        while (sharedRoot.getProperty(uid.next(), false)?._value) {
          // loop until find a usable id
        }
        prop = sharedRoot.getProperty(uid.current);
      }

      const sharedBlock = new SharedBlock(prop._block, null, prop);

      if (cacheKey) {
        sharedBlock._cacheKey = cacheKey;
        sharedBlock._cacheMode = data['#cacheMode'];
        SharedBlock._dict.set(cacheKey, sharedBlock);
      }
      prop.updateValue(sharedBlock);
      // shared block might need a temp function id to indicate its namespace
      let tempFuncId;
      if (funcId != null) {
        if (funcId.includes(':')) {
          tempFuncId = `${funcId}__shared`;
        }
      } else if (flow._namespace != null) {
        tempFuncId = `${flow._namespace}:__shared`;
      }
      sharedBlock.load(data, tempFuncId);
      return sharedBlock;
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in SharedBlockConfigGenerators) {
      return new SharedBlockConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _funcDispatcher: FunctionDispatcher;
  _funcListener: PropListener<FunctionClass> = {
    onSourceChange(prop: unknown) {},
    onChange: (val: FunctionClass) => {
      // _source is set after listener is attached, so the first change will be skipped
      if (this._cacheKey != null) {
        // force detach
        this._flows.clear();
        this.detachFlow(null);
      }
    },
  };
  _cacheKey: unknown;
  _cacheMode?: 'persist' | unknown;
  _flows = new Set<Flow>();
  attachFlow(flow: Flow) {
    this._flows.add(flow);
  }
  detachFlow(flow: Flow) {
    this._flows.delete(flow);
    if (this._flows.size === 0) {
      if (flow != null && this._cacheMode === 'persist') {
        // persisted SharedBlock only detach when detachFlow(null)
        return;
      }
      if (this._prop._value === this) {
        this._prop.setValue(undefined);
      }
    }
  }
  startHistory() {
    // history not allowed, maintained by the Flow that used this shared block
  }

  destroy(): void {
    if (this._funcDispatcher) {
      this._funcDispatcher.unlisten(this._funcListener);
    }
    if (this._cacheKey && SharedBlock._dict.get(this._cacheKey) === this) {
      SharedBlock._dict.delete(this._cacheKey);
    }
    super.destroy();
  }
}

export const FlowWithSharedConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#shared': SharedConfig,
};

export class FlowWithShared extends Flow {
  _sharedBlock: SharedBlock;

  getCacheKey(funcId: string, data: DataMap): unknown {
    return funcId || data;
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowWithSharedConfigGenerators) {
      return new FlowWithSharedConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _loadFlowData(map: DataMap, funcId?: string) {
    if (isSavedBlock(map['#shared'])) {
      SharedBlock.loadSharedBlock(this, funcId, map['#shared']);
    }
    super._load(map);
  }
  _setSharedBlock(block: SharedBlock) {
    if (block === this._sharedBlock) {
      return;
    }
    if (this._sharedBlock) {
      this._sharedBlock.detachFlow(this);
    }
    this._sharedBlock = block;
    if (block) {
      this._sharedBlock.attachFlow(this);
    }
    this.updateValue('#shared', block);
  }
  destroy(): void {
    if (this._sharedBlock) {
      this._sharedBlock.detachFlow(this);
      this._sharedBlock = null;
    }
    super.destroy();
  }
}
