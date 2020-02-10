import {configDescs, FunctionDesc} from '../block/Descriptor';

export const clientDescriptors: {[key: string]: FunctionDesc} = {
  input: {
    priority: 0,
    name: 'inputs',
    id: 'inputs',
    icon: 'fas:arrow-circle-down',
    color: 'e91',
    properties: [],
    configs: ['#value']
  },
  output: {
    priority: 0,
    name: 'outputs',
    id: 'outputs',
    icon: 'fas:arrow-circle-up',
    color: 'e91',
    properties: [],
    configs: ['#value', '#wait(#outputs)']
  }
};
