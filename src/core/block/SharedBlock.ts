import {Block} from './Block';
import {BlockProperty} from './BlockProperty';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {/* type */ Job, Root} from './Job';
import {Uid} from '../util/Uid';

export class SharedBlock extends Block {
  static uid = new Uid();
  static _dict = new Map<any, SharedBlock>();
  static loadSharedBlock(job: Job, funcId: string, data: DataMap): SharedBlock {
    let result: SharedBlock;
    if (SharedBlock._dict.has(data)) {
      result = SharedBlock._dict.get(data);
    } else {
      let uid = SharedBlock.uid;
      let sharedRoot = Root.instance._sharedRoot;
      while (sharedRoot.getProperty(uid.next(), false)?._value) {}
      let prop = sharedRoot.getProperty(uid.current);
      result = new SharedBlock(sharedRoot, sharedRoot, prop);
      result._source = data;
      SharedBlock._dict.set(data, result);
      prop.updateValue(result);
    }
    result.attachJob(job);
    return result;
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

export class ShareConfig extends BlockProperty {
  _load(val: any) {}

  _liveUpdate(val: any) {
    if (isSavedBlock(val)) {
      if (this._value instanceof SharedBlock) {
        this._value._liveUpdate(val);
      }
    }
  }
}
