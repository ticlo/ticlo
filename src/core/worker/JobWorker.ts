import {InputsBlock, Runnable} from '../block/Block';
import {JobWithShared, JobWithSharedConfigGenerators} from '../block/SharedBlock';
import {Root} from '../block/Job';
import {ConstTypeConfig} from '../block/BlockConfigs';
import {BlockConfig, BlockProperty} from '../block/BlockProperty';
import {Resolver} from '../block/Resolver';

export const JobWorkerConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobWithSharedConfigGenerators,
  '#is': ConstTypeConfig('job:worker')
};

export class JobWorker extends JobWithShared {
  _createConfig(field: string): BlockProperty {
    if (field in JobWorkerConfigGenerators) {
      return new JobWorkerConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  onWait(val: any) {
    let wait = Boolean(val);
    if (!wait && wait !== this._waiting) {
      this.scheduleCheckReady();
    }
    super.onWait(wait);
  }

  // make sure the input triggers a change
  updateInput(val: any) {
    super.updateInput(val);
    if (!this._waiting) {
      this.scheduleCheckReady();
    }
  }

  _onReady: () => void;
  set onReady(func: () => void) {
    this._onReady = func;
  }
  checkReady = () => {
    if (!this._waiting) {
      this._onReady?.();
    }
  };

  scheduleCheckReady() {
    if (this._onReady) {
      Resolver.callLater(this.checkReady);
      Root.instance._resolver.schedule();
      // TODO make it not static
    }
  }
}
