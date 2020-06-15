import {Block, BlockFunction, DataMap, Functions, encode, decode, NO_EMIT} from '../../src/core';
import {deepEqual} from '../../src/core/util/Compare';
import {isPrimitiveType} from '../../src/core/util/DataTypes';
import {updateObjectValue} from '../../src/core/property-api/ObjectValue';
import {FlowTestCase} from './FlowTestCase';

function convertActual(actual: any) {
  if (isPrimitiveType(actual) || Array.isArray(actual) || actual.constructor === Object) {
    return actual;
  }
  return decode(encode(actual));
}

export class AssertFunction extends BlockFunction {
  _matchedOnce = false;
  _called: any;
  onCall(val: any): boolean {
    if (val !== undefined) {
      this._called = val;
      this._matchedOnce = false;
      this._data.deleteValue('@b-style');
    }
    return super.onCall(val);
  }

  run(): any {
    if (this._data._sync && !this._called) {
      // in sync mode, must be called to run
      return;
    }
    if (this._matchedOnce && this._data.getValue('matchMode') !== 'always-match') {
      return;
    }
    let compares: {expect: any; actual: any}[] = this._data.getArray('', 1, ['expect', 'actual']);
    let matched = compares.length > 0;
    for (let {expect, actual} of compares) {
      if (actual === undefined) {
        // ignore when input is undefined
        return NO_EMIT;
      }
      if (!deepEqual(actual, expect)) {
        matched = false;
        break;
      }
    }
    this._data.output(matched);

    if (this._data._flow instanceof FlowTestCase) {
      let message: string = null;
      if (!matched) {
        message = this._data.getValue('@b-name');
        if (!message || typeof message !== 'string') {
          message = this._data._prop._name;
        }
      }
      this._data._flow.updateResult(this._data, message);
    }

    if (matched) {
      this._matchedOnce = true;
      updateObjectValue(this._data, '@b-style', {color: '4b2'});
    } else {
      updateObjectValue(this._data, '@b-style', {color: 'f44'});
      return NO_EMIT;
    }
  }
  cleanup(): void {
    this._data.deleteValue('@b-style');
    if (this._data._flow instanceof FlowTestCase) {
      this._data._flow.updateResult(this._data, null);
    }
  }
}

const API = {
  commands: {
    copyActualValue: (params: {[key: string]: any; property?: string}) => {},
  },
};

Functions.add(
  AssertFunction,
  {
    name: 'assert',
    priority: 2,
    mode: 'onChange',
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
    dynamicStyle: true,
  },
  'test',
  API
);
