import {Block, BlockChildWatch} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {WorkerFunction} from './WorkerFunction';
import {JobWithShared} from '../block/SharedBlock';
import {BlockProperty} from '..';
import {ConstTypeConfig, JobConfigGenerators} from '../block/BlockConfigs';
import {BlockConfig} from '../block/BlockProperty';

const blankWorker = {
  '#inputs': {'#is': ''},
  '#outputs': {'#is': ''}
};

export const JobEditorConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...JobConfigGenerators,
  '#is': ConstTypeConfig('job:editor')
};
export class JobEditor extends JobWithShared {
  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      super.unwatch(watcher);
      if (!this._watchers) {
        this._prop.setValue(undefined);
      }
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in JobEditorConfigGenerators) {
      return new JobEditorConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  static create(
    parent: Block,
    field: string,
    src?: DataMap,
    funcId?: string,
    forceLoad = false,
    applyChange?: (data: DataMap) => boolean
  ): JobEditor {
    let prop = parent.getProperty(field);
    let job: JobEditor;
    if (prop._value instanceof JobEditor) {
      // do not override the existing one that's being edited
      if (forceLoad) {
        job = prop._value;
      } else {
        return prop._value;
      }
    } else {
      job = new JobEditor(parent, null, prop);
      prop.setOutput(job);
    }
    if (funcId?.startsWith(':') && !applyChange) {
      applyChange = (data: DataMap) => {
        return WorkerFunction.applyChangeToFunc(job, null, data);
      };
    }
    let success = job.load(src, funcId, applyChange);
    if (success) {
      return job;
    } else {
      return null;
    }
  }

  static createFromField(parent: Block, field: string, fromField: string): JobEditor {
    let fromValue = parent.getValue(fromField);
    let forceReload = false;
    // already has worker data ?
    if (fromValue && (typeof fromValue === 'string' || fromValue.constructor === Object)) {
      let newJob: JobEditor;
      if (typeof fromValue === 'string') {
        newJob = JobEditor.create(parent, field, null, fromValue);
      } else {
        newJob = JobEditor.create(parent, field, fromValue, null, false, (data: DataMap) => {
          parent.setValue(fromField, data);
          return true;
        });
      }

      if (newJob) {
        return newJob;
      }
      // reload the existing job only when the previous loading failed
      forceReload = true;
    }

    if (parent._function) {
      let data = parent._function.getDefaultWorker(fromField) || blankWorker;
      return JobEditor.create(parent, field, data, null, forceReload, (data: DataMap) => {
        parent.setValue(fromField, data);
        return true;
      });
    }

    return null;
  }

  static createFromFunction(parent: Block, field: string, fromFunction: string, defaultData: DataMap): JobEditor {
    if (typeof fromFunction === 'string') {
      return JobEditor.create(parent, field, defaultData, fromFunction);
    }
    return null;
  }
}
