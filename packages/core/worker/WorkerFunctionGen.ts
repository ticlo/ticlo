import {FunctionGroup, coreFunctions} from '../block/FunctionGroup.js';
import {BaseFunction, FunctionClass, StatefulFunction} from '../block/BlockFunction.js';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {BlockIO} from '../block/BlockProperty.js';
import {Flow} from '../block/Flow.js';
import {DataMap} from '../util/DataTypes.js';
import {WorkerFlow} from './WorkerFlow.js';
import type {Block} from '../block/Block.js';
import {Namespace} from '../block/Namespace.js';
import {PersistentFunctionGroup} from '../block/NSFunctionGroup.js';

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
    let applyChange: (flow: Flow) => DataMap;
    // todo: fix applyChange
    if (this._namespace === '') {
      applyChange = (flow: Flow) => {
        return WorkerFunctionGen.applyChangeToFunc(this._funcFlow, null);
      };
    }
    this._funcFlow = this._data.createOutputFlow(WorkerFlow, '#flow', this.type, this._data, applyChange);
    this._funcFlow.updateInput(this._data);
  }

  cleanup(): void {
    this._data.deleteValue('#flow');
  }

  static generate(data: DataMap, funcId: string, namespace?: string): [FunctionClass, FunctionDesc] {
    const desc = WorkerFunctionGen.collectDesc(funcId, data);
    class CustomWorkerFunction extends WorkerFunctionGen {
      static ticlWorkerData = data;
      _namespace = namespace;
      static save() {
        return {
          type: 'worker',
          worker: CustomWorkerFunction.ticlWorkerData,
        };
      }
      static equals(other: DataMap) {
        return other['type'] === 'worker' && other['worker'] === data;
      }
    }

    if (!desc.priority) {
      desc.priority = 1;
    }
    desc.src = 'worker';
    return [CustomWorkerFunction, desc];
  }

  static registerType(data: DataMap, desc: FunctionDesc, namespace?: string, functionGroup?: FunctionGroup) {
    const fullId = desc.id ?? `${namespace}::${desc.name}`;
    let functions: FunctionGroup = functionGroup;
    if (!functions) {
      if (fullId.startsWith('+')) {
        functions = Namespace.getFunctionGroup(fullId);
      } else {
        functions = coreFunctions;
      }
    }

    const [func, generatedDesc] = WorkerFunctionGen.generate(data, fullId, namespace);
    functions.add(func, {...desc, ...generatedDesc}, namespace);
  }

  /**
   * save the worker to a function
   */
  static applyChangeToFunc(flow: Flow, funcId: string) {
    const data = flow.save();

    if (!funcId) {
      funcId = flow._loadFrom;
    }
    if (!funcId) {
      return null;
    }
    const namespace = flow._namespace;
    const [func, desc] = WorkerFunctionGen.generate(data, funcId, namespace);
    let functionGroup = Namespace.getFunctions(funcId, flow);
    if (functionGroup instanceof PersistentFunctionGroup) {
      functionGroup.add(func, desc, namespace);
    }

    return data;
  }

  static collectDesc(funcId: string, data: DataMap): FunctionDesc {
    let name: string;
    const pos = funcId.lastIndexOf(':');
    if (pos > -1) {
      name = funcId.substring(pos + 1);
    } else {
      return null;
    }
    let desc: FunctionDesc = {name, properties: WorkerFunctionGen.collectProperties(data)};
    const savedDesc = data['#desc'] as FunctionDesc;
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
    const properties: (PropDesc | PropGroupDesc)[] = [];
    const groups: Map<string, PropGroupDesc> = new Map();
    // add inputs
    const inputs = (data['#inputs'] as DataMap)?.['#custom'];
    if (Array.isArray(inputs)) {
      for (const input of inputs) {
        const copyInput = {...input};
        // input should not be readonly
        delete copyInput.readonly;
        properties.push(copyInput);
        if (input.type === 'group') {
          groups.set(input.name, input);
        }
      }
    }
    // add outputs
    const outputs = (data['#outputs'] as DataMap)?.['#custom'];
    let mainOutput: PropDesc;
    if (Array.isArray(outputs)) {
      for (const output of outputs) {
        if (output.type === 'group' && groups.has(output.name)) {
          const groupProperties = groups.get(output.name).properties;
          // merge output group with input group
          for (const prop of output.properties) {
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

PersistentFunctionGroup.registerType('worker', {
  load(data: DataMap, localFuncId: string, idPrefix: string, namespace?: string) {
    const fullId = `${idPrefix}:${localFuncId}`;
    const workerData = data['worker'] as DataMap;
    return WorkerFunctionGen.generate(workerData, fullId, namespace);
  },
});
