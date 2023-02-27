import {BlockConfig} from '../../block/BlockProperty';
import {BaseFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {defaultConfigs, PropDesc} from '../../block/Descriptor';
import {CreateObjectFunctionOptional} from '../data/CreateObject';
import HeadersDef from './HeadersDef';

Functions.add(
  CreateObjectFunctionOptional,
  {
    name: 'create-headers',
    icon: 'fas:list',
    optional: HeadersDef,
    properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
    configs: ([{name: '#extend', type: 'object'}] as (string | PropDesc)[]).concat(defaultConfigs),
  },
  'http'
);
