import {BaseFunction, defaultConfigs, Functions, PropDesc, PropGroupDesc} from '@ticlo/core';
import StyleDef from './StyleDef';
import {CreateObjectFunctionOptional} from '@ticlo/core/functions/data/CreateObject';

Functions.add(
  CreateObjectFunctionOptional,
  {
    name: 'create-style',
    icon: 'fab:css3',
    optional: StyleDef,
    properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
    configs: ([{name: '#extend', type: 'object'}] as (string | PropDesc)[]).concat(defaultConfigs),
  },
  'html'
);
