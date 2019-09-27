import {Block, BlockChildWatch, Job} from '../block/Block';
import {DataMap} from '../util/Types';
import {buildPropDescCache, findPropDesc, FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {Types} from '../block/Type';
import {WorkerFunction} from './WorkerFunction';

export class WorkerEditor extends Job {
  unwatch(watcher: BlockChildWatch) {
    if (this._watchers) {
      super.unwatch(watcher);
      if (!this._watchers) {
        this._prop.setValue(undefined);
      }
    }
  }

  static create(parent: Block, field: string, src?: DataMap | string, forceLoad = false): WorkerEditor {
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
    let success = job.load(src);
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

    // check if property desc has default worker data
    let funcDesc = Types.getDesc(parent.getValue('#is'))[0];
    let propertyCache = buildPropDescCache(funcDesc, parent.getValue('#more'));
    let src: DataMap;
    if (propertyCache) {
      let propDesc = findPropDesc(fromField, propertyCache);
      if (propDesc && propDesc.type === 'worker') {
        let placeHolderData: any = {
          '#is': '',
          '#input': {'#is': '', '#more': propDesc.inputs},
          '#output': {'#is': '', '#more': propDesc.outputs}
        };
        if (propDesc.inputs) {
          placeHolderData['#input']['@b-p'] = propDesc.inputs.filter((p) => p.type !== 'group').map((p) => p.name);
        }
        if (propDesc.outputs) {
          placeHolderData['#output']['@b-p'] = propDesc.outputs.filter((p) => p.type !== 'group').map((p) => p.name);
        }
        return WorkerEditor.create(parent, field, placeHolderData, forceReload);
      }
    }
    return null;
  }

  static createFromFunction(parent: Block, field: string, fromFunction: string): WorkerEditor {
    if (typeof fromFunction === 'string') {
      return WorkerEditor.create(parent, field, fromFunction);
    }
    return null;
  }

  applyChange(funcId: string = null): boolean {
    funcId = funcId || this._loadFrom;
    let data = this.save();
    if (funcId) {
      let name = funcId;
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
    } else {
      let name = this._prop._name;
      if (name.startsWith('#edit-')) {
        name = name.substring(6);
        this._prop._block.setValue(name, data);
        return true;
      }
    }
    return false;
  }

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
