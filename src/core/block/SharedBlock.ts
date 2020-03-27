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
  _save(): any {
    if (this._value instanceof SharedBlock) {
      return this._value.save();
    }
  }
}

export class SharedBlock extends Job {
  static uid = new Uid();
  static _dict = new Map<any, SharedBlock>();
  static _funcDict = new Map<string, SharedBlock>();
  static loadSharedBlock(job: JobWithShared, funcId: string, data: DataMap) {
    let useCache = job.cacheShared();
    if (funcId && useCache) {
      job._setSharedBlock(SharedBlock._loadFuncSharedBlock(job, funcId, data));
    } else {
      job._setSharedBlock(SharedBlock._loadSharedBlock(job, funcId, data, useCache));
    }
  }

  static _loadFuncSharedBlock(job: JobWithShared, funcId: string, data: DataMap) {
    if (SharedBlock._funcDict.has(funcId)) {
      return SharedBlock._funcDict.get(funcId);
    } else {
      let result: SharedBlock;
      let sharedRoot = Root.instance._sharedRoot;
      let prop = sharedRoot.getProperty(encodeTicloName(funcId));
      result = new SharedBlock(sharedRoot, sharedRoot, prop);
      result._funcDispatcher = Functions.listenRaw(funcId, result._funcListener);
      result._cacheKey = funcId;
      SharedBlock._funcDict.set(funcId, result);
      prop.updateValue(result);
      let sharedId;
      if (funcId.includes(':')) {
        sharedId = `${funcId}__shared`;
      }
      result.load(data, sharedId);
      return result;
    }
  }

  static _loadSharedBlock(job: JobWithShared, funcId: string, data: DataMap, useCache: boolean) {
    if (useCache && SharedBlock._dict.has(data)) {
      return SharedBlock._dict.get(data);
    } else {
      let result: SharedBlock;
      let uid = SharedBlock.uid;
      let sharedRoot = Root.instance._sharedRoot;
      while (sharedRoot.getProperty(uid.next(), false)?._value) {
        // loop until find a usable id
      }
      let prop = sharedRoot.getProperty(uid.current);
      result = new SharedBlock(sharedRoot, sharedRoot, prop);
      result._cacheKey = data;
      if (useCache) {
        SharedBlock._dict.set(data, result);
      }
      prop.updateValue(result);
      let sharedId;
      if (funcId != null) {
        if (funcId.includes(':')) {
          sharedId = `${funcId}__shared`;
        }
      } else if (job._namespace != null) {
        sharedId = `${job._namespace}:__shared`;
      }
      result.load(data, sharedId);
      return result;
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
  _jobs = new Set<Job>();
  attachJob(job: Job) {
    this._jobs.add(job);
  }
  detachJob(job: Job) {
    this._jobs.delete(job);
    if (this._jobs.size === 0) {
      this._prop.setValue(undefined);
      if (typeof this._cacheKey === 'string') {
        SharedBlock._funcDict.delete(this._cacheKey);
      } else {
        SharedBlock._dict.delete(this._cacheKey);
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
    super.destroy();
  }
}

export const JobWithSharedConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobConfigGenerators,
  '#is': ConstTypeConfig('job:shared'),
  '#shared': SharedConfig,
};

export class JobWithShared extends Job {
  _sharedBlock: SharedBlock;

  cacheShared() {
    return true;
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
