import {FunctionDesc} from '../block/Descriptor';

export const clientDescriptors: FunctionDesc[] = [
  {
    priority: 0,
    name: 'inputs',
    id: 'flow:inputs',
    icon: 'fas:circle-down',
    color: '9bd',
    properties: [],
    configs: ['#value'],
  },
  {
    priority: 0,
    name: 'outputs',
    id: 'flow:outputs',
    icon: 'fas:circle-up',
    color: '9bd',
    properties: [],
    configs: ['#value', '#wait(#outputs)'],
  },
  {
    priority: 0,
    name: 'main',
    id: 'flow:main',
    properties: [],
    icon: 'fas:file',
    color: '4af',
    src: 'hidden',
    ns: 'flow',
    configs: ['#disabled'],
  },
  {
    priority: 0,
    name: 'sub',
    id: 'flow:sub',
    properties: [],
    icon: 'fas:file',
    color: '4af',
    src: 'hidden',
    ns: 'flow',
    configs: ['#disabled'],
  },
  {
    priority: 0,
    name: 'const',
    id: 'flow:const',
    properties: [],
    icon: 'fas:file',
    color: '4af',
    src: 'hidden',
    ns: 'flow',
    configs: [],
  },
  {
    priority: 0,
    name: 'worker',
    id: 'flow:worker',
    properties: [],
    icon: 'fas:file',
    color: '9bd',
    src: 'hidden',
    ns: 'flow',
    configs: ['#desc', '#disabled'],
  },
  {
    priority: 0,
    name: 'editor',
    id: 'flow:editor',
    properties: [],
    icon: 'fas:file',
    color: '9bd',
    src: 'hidden',
    ns: 'flow',
    configs: ['#desc', '#disabled'],
  },
  {
    priority: 0,
    name: 'shared',
    id: 'flow:shared',
    properties: [],
    icon: 'fas:file',
    color: '4af',
    src: 'hidden',
    ns: 'flow',
    configs: ['#cacheMode', '#disabled'],
  },
  {
    priority: 0,
    name: 'settings',
    id: 'flow:settings',
    properties: [
      {name: 'defaultLanguage', type: 'string'},
      {name: 'timezone', type: 'string', readonly: true},
      {name: 'firstDayOfWeek', type: 'number', step: 1, min: 1, max: 7, default: 7},
    ],
    icon: 'fas:gear',
    color: '9bd',
    src: 'hidden',
    ns: 'flow',
  },
  {
    priority: 0,
    name: 'test-case',
    id: 'flow:test-case',
    properties: [],
    icon: 'fas:vial',
    color: 'fa1',
    src: 'hidden',
    ns: 'flow',
    configs: ['#disabled'],
    dynamicStyle: true,
    commands: {start: {parameters: []}},
  },
  {
    priority: 0,
    name: 'test-group',
    id: 'flow:test-group',
    properties: [],
    icon: 'fas:vials',
    color: '999',
    src: 'hidden',
    ns: 'flow',
    configs: ['#disabled'],
    dynamicStyle: true,
  },
];
