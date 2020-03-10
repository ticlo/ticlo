import './Block';
import {BlockConfig, BlockProperty} from './BlockProperty';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {ConstTypeConfig, JobConfigGenerators} from './BlockConfigs';
import {Job, Root} from './Job';
import {Uid} from '../util/Uid';

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
  static loadSharedBlock(job: JobWithShared, funcId: string, data: DataMap) {
    let result: SharedBlock;
    if (SharedBlock._dict.has(data)) {
      result = SharedBlock._dict.get(data);
    } else {
      let uid = SharedBlock.uid;
      let sharedRoot = Root.instance._sharedRoot;
      while (sharedRoot.getProperty(uid.next(), false)?._value) {
        // loop until find a usable id
      }
      let prop = sharedRoot.getProperty(uid.current);
      result = new SharedBlock(sharedRoot, sharedRoot, prop);
      result._source = data;
      SharedBlock._dict.set(data, result);
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
    }
    job._setSharedBlock(result);
  }

  _source: any;
  _jobs = new Set<Job>();
  attachJob(job: Job) {
    this._jobs.add(job);
  }
  detachJob(job: Job) {
    this._jobs.delete(job);
    if (this._jobs.size === 0) {
      this._prop.setValue(undefined);
      SharedBlock._dict.delete(this._source);
    }
  }
}

export const JobWithSharedConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobConfigGenerators,
  '#is': ConstTypeConfig('job:shared'),
  '#shared': SharedConfig
};

export class JobWithShared extends Job {
  _sharedBlock: SharedBlock;

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
