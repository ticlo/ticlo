import {Block, BlockChildWatch, Job} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {buildPropDescCache, findPropDesc, FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {Functions} from '../block/Functions';
import {WorkerFunction} from './WorkerFunction';

const blankWorker = {
  '#inputs': {'#is': ''},
  '#outputs': {'#is': ''}
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
    src?: DataMap,
    funcId?: string,
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
    if (funcId?.startsWith(':') && !applyChange) {
      applyChange = (data: DataMap) => {
        return job.applyChangeToFunc(funcId, data);
      };
    }
    let success = job.load(src, funcId, applyChange);
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
      let newJob: WorkerEditor;
      if (typeof fromValue === 'string') {
        newJob = WorkerEditor.create(parent, field, null, fromValue);
      } else {
        newJob = WorkerEditor.create(parent, field, fromValue, null, false, (data: DataMap) => {
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
      return WorkerEditor.create(parent, field, data, null, forceReload, (data: DataMap) => {
        parent.setValue(fromField, data);
        return true;
      });
    }

    return null;
  }

  static createFromFunction(parent: Block, field: string, fromFunction: string, defaultData: DataMap): WorkerEditor {
    if (typeof fromFunction === 'string') {
      return WorkerEditor.create(parent, field, defaultData, fromFunction);
    }
    return null;
  }

  /**
   * save the worker to a function
   */
  applyChangeToFunc(funcId: string, data?: DataMap) {
    if (!data) {
      data = this.save();
    }
    // save to worker function
    let name = this._loadFrom;
    let pos = name.indexOf(':');
    if (pos > -1) {
      name = name.substring(pos + 1);
    }
    let desc: FunctionDesc = {name, properties: this.collectProperties()};
    let savedDesc = this.getValue('#desc') as FunctionDesc;
    if (savedDesc && typeof savedDesc === 'object' && savedDesc.constructor === Object) {
      desc = {...savedDesc, ...desc, id: funcId};
    }

    WorkerFunction.registerType(data, desc, this._namespace);
    return true;
  }

  /**
   * collect function parameters for creating worker function
   */
  collectProperties() {
    let properties: (PropDesc | PropGroupDesc)[] = [];
    let groups: Map<string, PropGroupDesc> = new Map();
    // add inputs
    let inputs = this.queryValue('#inputs.#custom');
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
    let outputs = this.queryValue('#outputs.#custom');
    let mainOutput: PropDesc;
    if (Array.isArray(outputs)) {
      for (let output of outputs) {
        if (output.type === 'group' && groups.has(output.name)) {
          let groupProperties = groups.get(output.name).properties;
          // merge output group with input group
          for (let prop of output.properties) {
            groupProperties.push({...prop, readonly: true});
          }
        } else {
          if (output.name === '#output') {
            mainOutput = {...output, readonly: true};
          } else {
            properties.push({...output, readonly: true});
          }
        }
      }
    }
    if (mainOutput) {
      // #output must be the last property
      properties.push(mainOutput);
    }
    return properties;
  }
}
