import './Block';
import {BlockConfig, BlockProperty} from './BlockProperty';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {ConstTypeConfig, JobConfigGenerators} from './BlockConfigs';
import {Job, Root} from './Job';
import {Uid} from '../util/Uid';
import {encodeTicloName} from '../util/Name';
import {FunctionDispatcher, Functions} from './Functions';
import {FunctionClass} from './BlockFunction';
import {PropListener} from './Dispatcher';

export class SharedConfig extends BlockProperty {
  _load(val: any) {}

  _liveUpdate(val: any) {
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

  _saveValue(): any {
    if (this._value instanceof SharedBlock) {
      let result = this._value.save();
      // check if SharedBlock is needed even with no child block
      if ('#cacheMode' in result || '#custom' in result) {
        return result;
      }
      // check if there is a child block
      for (let key in result) {
        if (isSavedBlock(result[key])) {
          return result;
        }
      }
    }
    return undefined;
  }
}

export const SharedBlockConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobConfigGenerators,
  '#is': ConstTypeConfig('job:shared'),
};

export class SharedBlock extends Job {
  static uid = new Uid();
  static _dict = new Map<any, SharedBlock>();
  static loadSharedBlock(job: JobWithShared, funcId: string, data: DataMap) {
    let cacheKey = job.getCacheKey(funcId, data);
    let sharedBlock: SharedBlock;
    if (typeof cacheKey === 'string') {
      sharedBlock = SharedBlock._loadFuncSharedBlock(job, cacheKey, data);
    } else {
      sharedBlock = SharedBlock._loadSharedBlock(job, funcId, data, cacheKey);
    }
    job._setSharedBlock(sharedBlock);
    return sharedBlock;
  }

  static _loadFuncSharedBlock(job: JobWithShared, funcId: string, data: DataMap) {
    if (SharedBlock._dict.has(funcId)) {
      return SharedBlock._dict.get(funcId);
    } else {
      let sharedBlock: SharedBlock;
      let sharedRoot = Root.instance._sharedRoot;
      let prop = sharedRoot.getProperty(encodeTicloName(funcId));
      sharedBlock = new SharedBlock(sharedRoot, sharedRoot, prop);
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

  static _loadSharedBlock(job: JobWithShared, funcId: string, data: DataMap, cacheKey: any) {
    if (cacheKey && SharedBlock._dict.has(cacheKey)) {
      return SharedBlock._dict.get(cacheKey);
    } else {
      let sharedBlock: SharedBlock;

      // find a property to store the shared block
      let prop: BlockProperty;
      if (cacheKey instanceof BlockProperty) {
        // usually used by repeater blocks
        prop = cacheKey;
      } else {
        // find a property from global sharedRoot
        let uid = SharedBlock.uid;
        let sharedRoot = Root.instance._sharedRoot;
        while (sharedRoot.getProperty(uid.next(), false)?._value) {
          // loop until find a usable id
        }
        prop = sharedRoot.getProperty(uid.current);
      }

      sharedBlock = new SharedBlock(prop._block, null, prop);

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
      } else if (job._namespace != null) {
        tempFuncId = `${job._namespace}:__shared`;
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
    onSourceChange(prop: any) {},
    onChange: (val: FunctionClass) => {
      // _source is set after listener is attached, so the first change will be skipped
      if (this._cacheKey != null) {
        // force detach
        this._jobs.clear();
        this.detachJob(null);
      }
    },
  };
  _cacheKey: any;
  _cacheMode?: 'persist';
  _jobs = new Set<Job>();
  attachJob(job: Job) {
    this._jobs.add(job);
  }
  detachJob(job: Job) {
    this._jobs.delete(job);
    if (this._jobs.size === 0) {
      if (job != null && this._cacheMode === 'persist') {
        // persisted SharedBlock only detach when detachJob(null)
        return;
      }
      if (this._prop._value === this) {
        this._prop.setValue(undefined);
      }
    }
  }
  startHistory() {
    // history not allowed, maintained by the Job that used this shared block
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

export const JobWithSharedConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobConfigGenerators,
  '#shared': SharedConfig,
};

export class JobWithShared extends Job {
  _sharedBlock: SharedBlock;

  getCacheKey(funcId: string, data: DataMap): any {
    return funcId || data;
  }

  _createConfig(field: string): BlockProperty {
    if (field in JobWithSharedConfigGenerators) {
      return new JobWithSharedConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _loadJobData(map: DataMap, funcId?: string) {
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
      this._sharedBlock.detachJob(this);
    }
    this._sharedBlock = block;
    if (block) {
      this._sharedBlock.attachJob(this);
    }
    this.updateValue('#shared', block);
  }
  destroy(): void {
    if (this._sharedBlock) {
      this._sharedBlock.detachJob(this);
      this._sharedBlock = null;
    }
    super.destroy();
  }
}
