import {FunctionDesc} from '../block/Descriptor';

export const clientDescriptors: {[key: string]: FunctionDesc} = {
  inputs: {
    priority: 0,
    name: 'inputs',
    id: 'inputs',
    icon: 'fas:arrow-circle-down',
    color: 'e91',
    properties: [],
    configs: ['#value']
  },
  outputs: {
    priority: 0,
    name: 'outputs',
    id: 'outputs',
    icon: 'fas:arrow-circle-up',
    color: 'e91',
    properties: [],
    configs: ['#value', '#wait(#outputs)']
  }
};
