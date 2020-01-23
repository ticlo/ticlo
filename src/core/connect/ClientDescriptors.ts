import {configDescs, FunctionDesc} from '../block/Descriptor';

export const clientDescriptors: {[key: string]: FunctionDesc} = {
  input: {
    priority: 0,
    name: 'input',
    id: 'input',
    icon: 'fas:arrow-circle-down',
    color: 'e91',
    properties: [],
    configs: [configDescs['#value']]
  },
  output: {
    priority: 0,
    name: 'output',
    id: 'output',
    icon: 'fas:arrow-circle-up',
    color: 'e91',
    properties: [],
    configs: [configDescs['#value'], configDescs['#wait(output)']]
  }
};
