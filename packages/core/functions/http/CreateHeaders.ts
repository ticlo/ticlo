import {BlockConfig} from '../../block/BlockProperty.js';
import {BaseFunction} from '../../block/BlockFunction.js';
import {Functions} from '../../block/Functions.js';
import {defaultConfigs, PropDesc} from '../../block/Descriptor.js';
import {CreateObjectFunctionOptional} from '../data/CreateObject.js';
import HeadersDef from './HeadersDef.js';

Functions.add(
  CreateObjectFunctionOptional,
  {
    name: 'create-headers',
    icon: 'txt:H',
    optional: HeadersDef,
    properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
    configs: ([{name: '+extend', type: 'object'}] as (string | PropDesc)[]).concat(defaultConfigs),
  },
  'http'
);
