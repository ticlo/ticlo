import {BlockFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {Block} from '../../block/Block';
import {isDataMap, isPrimitiveType} from '../../util/DataTypes';
import {Resolver} from '../../block/Resolver';

export class StorageFunction extends BlockFunction {
  run() {}
}

Functions.add(
  StorageFunction,
  {
    name: 'storage',
    icon: 'fas:code-branch',
    mode: 'onCall',
    priority: 1,
    properties: [
      {
        name: '',
        type: 'group',
        defaultLen: 1,
        properties: [
          {name: 'key', type: 'string', pinned: true},
          {name: 'value', type: 'any', pinned: true},
        ],
      },
      {name: 'savable', type: 'toggle'},
      {name: 'async', type: 'toggle'},
    ],
    commands: {
      saveSnapshot: {parameters: []},
    },
    category: 'data',
    color: '1bb',
  },
  undefined
);
