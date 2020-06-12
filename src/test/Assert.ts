import {BlockFunction, Functions} from '../../src/core';
import {deepEqual} from '../core/util/Compare';

function assertCompare(actual: any, expect: any) {}

export class AssertFunction extends BlockFunction {
  run(): any {
    let compares: {expect: any; actual: any}[] = this._data.getArray('', 1, ['expect', 'actual']);
    let matched = compares.length > 0;
    for (let {expect, actual} of compares) {
    }
  }
}

Functions.add(
  AssertFunction,
  {
    name: 'assert',
    priority: 1,
    properties: [
      {
        name: '',
        type: 'group',
        defaultLen: 1,
        properties: [
          {name: 'expect', type: 'any', pinned: true},
          {name: 'actual', type: 'any', pinned: true},
        ],
      },
      {name: 'matchMode', type: 'radio-button', options: ['match-once', 'always-match'], default: 'match-once'},
      {name: '#output', type: 'toggle', readonly: true, pinned: true},
    ],
  },
  'test'
);
