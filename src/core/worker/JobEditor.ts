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

  static create(parent: Block, field: string, src?: DataMap | string): JobEditor {
    let prop = parent.getProperty(field);
    if (prop._value instanceof JobEditor) {
      // do not override the existing one that's being edited
      return prop._value;
    }
    let job = new JobEditor(parent, null, prop);
    prop.setOutput(job);
    job.load(src);
    return job;
  }

  static createFromField(parent: Block, field: string, fromField: string): JobEditor {
    // already has worker data
    let fromValue = parent.getValue(fromField);
    if (typeof fromValue === 'string' || fromValue.constructor === Object) {
      return JobEditor.create(parent, field, fromValue);
    }

    // check if property desc has default worker data
    let funcDesc = Types.getDesc(parent.getValue('#is'))[0];
    let propertyCache = buildPropDescCache(funcDesc, null);
    let src: DataMap;
    if (propertyCache) {
      let prop = findPropDesc(fromField, propertyCache);
      // if (prop && prop.) {
      //
      // }
    }


  }
}
