import {Block, BlockChildWatch, Job} from "../block/Block";
import {DataMap} from "../util/Types";

export class JobEditor extends Job {
  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      super.unwatch(watcher);
      if (!this._watchers) {
        this._prop.setValue(undefined);
      }
    }
  }

  static create(parent: Block, field: string, src?: DataMap, namespace?: string): JobEditor {
    let prop = parent.getProperty(field);
    if (prop._value instanceof JobEditor) {
      // do not override the existing one that's being edited
      return prop._value;
    }
    let job = new JobEditor(parent, null, prop);
    prop.setOutput(job);
    if (namespace) {
      job._namespace = namespace;
    }
    if (src) {
      job.load(src);
    }
    return job;
  }
}
