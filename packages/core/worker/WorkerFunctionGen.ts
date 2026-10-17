import {FunctionLib, globalFunctions} from '../block/FunctionLib.ts';
import {BaseFunction, createFunctionFactory, FunctionFactory, StatefulFunction} from '../block/BlockFunction.ts';
import {deepEqual} from '../util/Compare.ts';
import {defaultConfigs, FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor.ts';
import {BlockIO} from '../block/BlockProperty.ts';
import {Flow} from '../block/Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {WorkerFlow} from './WorkerFlow.ts';
import {Block} from '../block/Block.ts';
import {Namespace} from '../block/Namespace.ts';
import {FlowFunctionLib, NsFunctionLib} from '../block/NSFunctionLib.ts';

const inheritedMainOutputTags = ['react-comp'];

export class WorkerFunctionGen extends BaseFunction<Block> {
  declare readonly type: string;
  declare _namespace: string;
  declare _funcFlow: WorkerFlow;

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(): any {
    const applyChange = (flow: Flow) => WorkerFunctionGen.applyChangeToFunc(flow, null);
    this._funcFlow = this._data.createOutputFlow(WorkerFlow, '#worker', this.type, this._data, applyChange);
    this._funcFlow.updateInput(this._data);
  }

  cleanup(): void {
    this._data.deleteValue('#worker');
  }

  static generate(data: DataMap, funcId: string, namespace?: string): FunctionFactory {
    const desc = WorkerFunctionGen.collectDesc(funcId, data);
    class CustomWorkerFunction extends WorkerFunctionGen {
      _namespace = namespace;
    }

    if (!desc.priority) {
      desc.priority = 1;
    }
    desc.src = 'worker';
    return createFunctionFactory(CustomWorkerFunction, desc, {
      ticlWorkerData: data,
      save() {
        return {
          type: 'worker',
          worker: data,
        };
      },
      equals(other: DataMap) {
        return other['type'] === 'worker' && deepEqual(other['worker'], data);
      },
    });
  }

  static registerType(data: DataMap, desc: FunctionDesc, namespace?: string, functionLib?: FunctionLib) {
    const fullId = desc.id ?? `${namespace}::${desc.name}`;
    let functions: FunctionLib = functionLib;
    if (!functions) {
      if (fullId.startsWith('+')) {
        functions = Namespace.getFunctionLib(fullId);
      } else {
        functions = globalFunctions;
      }
    }

    const factory = WorkerFunctionGen.generate(data, fullId, namespace);
    functions.add({...factory, desc: {...desc, ...factory.desc}}, namespace);
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
    // Inherit allowed tags from the block directly bound to #outputs.#main.
    // Workers declaring #order also inherit the component's accepted child tags.
    const outputs = flow.getValue('#outputs');
    const mainBinding = (data['#outputs'] as DataMap)?.['~#main'];
    if (outputs instanceof Block && typeof mainBinding === 'string') {
      const main = outputs.queryProperty(mainBinding)?._saved;
      if (main instanceof Block) {
        const sourceDesc = main._funcSrc?.getValue()?.desc;
        const tags = inheritedMainOutputTags.filter((tag) => sourceDesc?.tags?.includes(tag));
        if (tags.length) {
          const desc = data['#desc'] as FunctionDesc;
          data['#desc'] = {...desc, tags: [...new Set([...(desc?.tags ?? []), ...tags])]};
          const inputs = (data['#inputs'] as DataMap)?.['#custom'] as PropDesc[];
          if (Array.isArray(inputs) && inputs.some((prop) => prop.name === '#order')) {
            (data['#desc'] as FunctionDesc).childrenTags = sourceDesc.childrenTags;
          }
        }
      }
    }
    const desc = data['#desc'] as FunctionDesc;
    if (desc?.tags?.includes('react-comp')) {
      const inputs = flow.getValue('#inputs');
      const style = (inputs instanceof Block ? inputs.getValue('style') : (inputs as DataMap)?.style) as
        | Block
        | DataMap;
      const width = style instanceof Block ? style.getValue('width') : style?.width;
      const height = style instanceof Block ? style.getValue('height') : style?.height;
      if (width != null && height != null) {
        data['#desc'] = {
          ...desc,
          init: {...desc.init, style: {...(desc.init?.style as DataMap), width, height}},
        };
      }
    }
    const namespace = flow._namespace;
    const factory = WorkerFunctionGen.generate(data, funcId, namespace);
    const functionLib = Namespace.getFunctions(funcId, flow);
    functionLib?.add(factory, namespace);
    if (functionLib instanceof NsFunctionLib && functionLib.pendingSave) {
      return functionLib.pendingSave.then(() => data);
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
    const configs = desc.properties.filter((prop) => prop.name === '#main' || prop.name === '#order') as PropDesc[];
    if (configs.length) {
      desc.properties = desc.properties.filter((prop) => prop.name !== '#main' && prop.name !== '#order');
      const configMap = new Map(
        (desc.configs ?? defaultConfigs).map((config) => [typeof config === 'string' ? config : config.name, config])
      );
      for (const config of configs) configMap.set(config.name, config);
      desc.configs = [...configMap.values()];
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
        if (input.type === 'group') {
          groups.set(input.name, copyInput as PropGroupDesc);
        }
        properties.push(copyInput);
      }
    }
    // add outputs
    const outputs = (data['#outputs'] as DataMap)?.['#custom'];
    let mainOutput: PropDesc;
    if (Array.isArray(outputs)) {
      for (const output of outputs) {
        const group = output.type === 'group' && groups.get(output.name);
        if (group) {
          if (Array.isArray(output.properties) && output.properties.length > 0) {
            const groupProperties = Array.isArray(group.properties)
              ? group.properties.map((prop: PropDesc) => ({...prop}))
              : [];
            group.properties = groupProperties;
            // merge output group with input group
            for (const prop of output.properties) {
              groupProperties.push({...prop, readonly: true});
            }
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

FlowFunctionLib.registerType('worker', {
  load(data: DataMap, localFuncId: string, fullId: string, namespace?: string) {
    const workerData = data['worker'] as DataMap;
    return WorkerFunctionGen.generate(workerData, fullId, namespace);
  },
});
