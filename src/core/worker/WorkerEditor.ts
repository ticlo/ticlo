import {Block, BlockChildWatch, Job} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {buildPropDescCache, findPropDesc, FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {Types} from '../block/Type';
import {WorkerFunction} from './WorkerFunction';

const blankWorker = {
  '#input': {'#is': ''},
  '#output': {'#is': ''}
};

export class WorkerEditor extends Job {
  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      super.unwatch(watcher);
      if (!this._watchers) {
        this._prop.setValue(undefined);
      }
    }
  }

  static create(
    parent: Block,
    field: string,
    src?: DataMap | string,
    forceLoad = false,
    applyChange?: (data: DataMap) => boolean
  ): WorkerEditor {
    let prop = parent.getProperty(field);
    let job: WorkerEditor;
    if (prop._value instanceof WorkerEditor) {
      // do not override the existing one that's being edited
      if (forceLoad) {
        job = prop._value;
      } else {
        return prop._value;
      }
    } else {
      job = new WorkerEditor(parent, null, prop);
      prop.setOutput(job);
    }
    let success = job.load(src, applyChange);
    if (success) {
      return job;
    } else {
      return null;
    }
  }

  static createFromField(parent: Block, field: string, fromField: string): WorkerEditor {
    let fromValue = parent.getValue(fromField);
    let forceReload = false;
    // already has worker data ?
    if (fromValue && (typeof fromValue === 'string' || fromValue.constructor === Object)) {
      let newJob = WorkerEditor.create(parent, field, fromValue);
      if (newJob) {
        return newJob;
      }
      // reload the existing job only when the previous loading failed
      forceReload = true;
    }

    if (parent._function) {
      let data = parent._function.getDefaultWorker(fromField) || blankWorker;
      return WorkerEditor.create(parent, field, data, forceReload, (data: DataMap) => {
        parent.setValue(fromField, data);
        return true;
      });
    }

    return null;
  }

  static createFromFunction(parent: Block, field: string, fromFunction: string): WorkerEditor {
    if (typeof fromFunction === 'string') {
      return WorkerEditor.create(parent, field, fromFunction);
    }
    return null;
  }

  /**
   * save the worker to a function
   * @param funcId When specified, save the worker as a global worker function so it can be reused
   */
  applyChangeToFunc(funcId: string) {
    let data = this.save();
    // save to worker function
    let name = this._loadFrom;
    let pos = name.indexOf(':');
    if (pos > -1) {
      name = name.substring(pos + 1);
    }
    let desc: FunctionDesc = {
      name,
      icon: this.getValue('@f-icon') || '',
      priority: this.getValue('@f-priority') || 0,
      mode: this.getValue('@f-mode') || 'onLoad',
      properties: this.collectProperties()
    };

    WorkerFunction.registerType(data, desc, this._namespace);
    return true;
  }
  applyChange(): boolean {
    if (this._loadFrom && !this._applyChange) {
      return this.applyChangeToFunc(this._loadFrom);
    } else {
      return super.applyChange();
    }
  }

  /**
   * collect function parameters for creating worker function
   */
  collectProperties() {
    let properties: (PropDesc | PropGroupDesc)[] = [];
    let groups: Map<string, PropGroupDesc> = new Map();
    // add inputs
    let inputs = this.queryValue('#input.#more');
    if (Array.isArray(inputs)) {
      for (let input of inputs) {
        let copyInput = {...input};
        // input should not be readonly
        delete copyInput.readonly;
        properties.push(copyInput);
        if (input.type === 'group') {
          groups.set(input.name, input);
        }
      }
    }
    // add outputs
    let outputs = this.queryValue('#output.#more');
    if (Array.isArray(outputs)) {
      for (let output of outputs) {
        if (output.type === 'group' && groups.has(output.name)) {
          let groupProperties = groups.get(output.name).properties;
          // merge output group with input group
          for (let prop of output.properties) {
            groupProperties.push({...prop, readonly: true});
          }
        } else {
          properties.push({...output, readonly: true});
        }
      }
    }
    return properties;
  }
}
