import {BlockConfig} from '../../block/BlockProperty.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {defaultConfigs, PropDesc} from '../../block/Descriptor.ts';
import {CreateObjectFunctionOptional} from '../data/CreateObject.ts';
import HeadersDef from './HeadersDef.ts';

globalFunctions.addFactory(
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
