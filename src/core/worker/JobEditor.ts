import {Block, BlockChildWatch, Job} from "../block/Block";
import {DataMap} from "../util/Types";
import {buildPropDescCache, findPropDesc, FunctionDesc} from "../block/Descriptor";
import {Types} from "../block/Type";
import {WorkerFunction} from "./WorkerFunction";

export class JobEditor extends Job {
  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      super.unwatch(watcher);
      if (!this._watchers) {
        this._prop.setValue(undefined);
      }
    }
  }

  static create(parent: Block, field: string, src?: DataMap | string, forceLoad = false): JobEditor {
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
    let success = job.load(src);
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
    if (typeof fromValue === 'string' || fromValue.constructor === Object) {
      let newJob = JobEditor.create(parent, field, fromValue);
      if (newJob) {
        return newJob;
      }
      // reload the existing job only when the previous loading failed
      forceReload = true;
    }

    // check if property desc has default worker data
    let funcDesc = Types.getDesc(parent.getValue('#is'))[0];
    let propertyCache = buildPropDescCache(funcDesc, null);
    let src: DataMap;
    if (propertyCache) {
      let propDesc = findPropDesc(fromField, propertyCache);
      if (propDesc && propDesc.type === 'worker') {
        let placeHolderData = {
          '#is': '',
          '#input': {'#is': '', '@b-more': propDesc.inputs},
          '#output': {'#is': '', '@b-more': propDesc.outputs},
        };
        JobEditor.create(parent, field, placeHolderData, forceReload);
      }
    }
  }
}
