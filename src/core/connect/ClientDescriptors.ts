import {FunctionDesc} from '../block/Descriptor';

export const clientDescriptors: {[key: string]: FunctionDesc} = {
  input: {
    priority: 0,
    name: 'input',
    id: 'input',
    icon: 'fas:arrow-circle-down',
    style: 'repeater',
    properties: []
  },
  output: {
    priority: 0,
    name: 'output',
    id: 'output',
    icon: 'fas:arrow-circle-up',
    style: 'repeater',
    properties: [{name: '#wait', type: 'toggle'}]
  }
};
