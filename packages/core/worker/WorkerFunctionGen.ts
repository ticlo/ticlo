import {Functions} from '../block/Functions.js';
import {BaseFunction, StatefulFunction} from '../block/BlockFunction.js';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {BlockIO} from '../block/BlockProperty.js';
import {Flow} from '../block/Flow.js';
import {DataMap} from '../util/DataTypes.js';
import {WorkerFlow} from './WorkerFlow.js';
import type {Block} from '../block/Block.js';

/**
 * WorkerFunction is the function wrapper for all custom functions
 */
export class WorkerFunctionGen extends BaseFunction<Block> {
  declare readonly type: string;
  declare _namespace: string;
  declare _funcFlow: WorkerFlow;

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(): any {
    let applyChange: (data: DataMap) => boolean;
    if (this._namespace === '') {
      applyChange = (data: DataMap) => {
        return WorkerFunctionGen.applyChangeToFunc(this._funcFlow, null, null, data);
      };
    }
    this._funcFlow = this._data.createOutputFlow(WorkerFlow, '#flow', this.type, this._data, applyChange);
    this._funcFlow.updateInput(this._data);
  }

  cleanup(): void {
    this._data.deleteValue('#flow');
  }

  static registerType(data: DataMap, desc: FunctionDesc, namespace?: string) {
    class CustomWorkerFunction extends WorkerFunctionGen {
      static ticlWorkerData = data;
    }

    if (!desc.priority) {
      desc.priority = 1;
    }
    desc.src = 'worker';

    CustomWorkerFunction.prototype._namespace = namespace;

    Functions.add(CustomWorkerFunction, desc, namespace);
  }

  /**
   * save the worker to a function
   */
  static applyChangeToFunc(flow: Flow, funcId: string, namespace?: string, data?: DataMap) {
    if (!data) {
      data = flow.save();
    }
    if (!funcId) {
      funcId = flow._loadFrom;
    }
    if (!funcId) {
      return false;
    }
    if (namespace == null) {
      namespace = flow._namespace;
    }
    let desc = WorkerFunctionGen.collectDesc(funcId, data);
    Functions.saveWorkerFunction(funcId, flow, data);
    WorkerFunctionGen.registerType(data, desc, namespace);
    return true;
  }

  static collectDesc(funcId: string, data: DataMap): FunctionDesc {
    let name: string;
    let pos = funcId.indexOf(':');
    if (pos > -1) {
      name = funcId.substring(pos + 1);
    } else {
      return null;
    }
    let desc: FunctionDesc = {name, properties: WorkerFunctionGen.collectProperties(data)};
    let savedDesc = data['#desc'] as FunctionDesc;
    if (savedDesc && typeof savedDesc === 'object' && savedDesc.constructor === Object) {
      desc = {...savedDesc, ...desc};
    }
    desc.id = funcId;
    return desc;
  }
  /**
   * collect function parameters for creating worker function
   */
  static collectProperties(data: DataMap) {
    let properties: (PropDesc | PropGroupDesc)[] = [];
    let groups: Map<string, PropGroupDesc> = new Map();
    // add inputs
    let inputs = (data['#inputs'] as DataMap)?.['#custom'];
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
    let outputs = (data['#outputs'] as DataMap)?.['#custom'];
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
