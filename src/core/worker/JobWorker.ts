import {JobWithShared, JobWithSharedConfigGenerators} from '../block/SharedBlock';
import {BlockProperty} from '..';
import {ConstTypeConfig} from '../block/BlockConfigs';
import {BlockConfig} from '../block/BlockProperty';

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
}
