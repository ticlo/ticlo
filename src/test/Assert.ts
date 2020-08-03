import {Block, BlockFunction, DataMap, Functions, encode, decode, NO_EMIT} from '../../src/core';
import {deepEqual} from '../../src/core/util/Compare';
import {isPrimitiveType} from '../../src/core/util/DataTypes';
import {updateObjectValue} from '../../src/core/property-api/ObjectValue';
import {FlowTestCase} from './FlowTestCase';

const EXPECT = 'expect';
const ACTUAL = 'actual';

function convertActual(actual: any) {
  if (isPrimitiveType(actual) || Array.isArray(actual) || actual.constructor === Object) {
    return actual;
  }
  return decode(encode(actual));
}

export class AssertFunction extends BlockFunction {
  _matched = false;
  _called: any;
  onCall(val: any): boolean {
    if (val !== undefined) {
      this._called = val;
      this._matched = false;
      this._data.deleteValue('@b-style');
    }
    return super.onCall(val);
  }

  run(): any {
    if (this._data._sync && !this._called) {
      // in sync mode, must be called to run
      return;
    }
    if (this._matched && this._data.getValue('matchMode') !== 'always-match') {
      return;
    }
    let compares: {expect: any; actual: any}[] = this._data.getArray('', 1, [EXPECT, ACTUAL]);
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
    this._matched = matched;
    this._data.output(matched);

    if (this._data._flow instanceof FlowTestCase) {
      // let message: string = null;
      // if (!matched) {
      //   message = this._data.getValue('@b-name');
      //   if (!message || typeof message !== 'string') {
      //     message = this._data._prop._name;
      //   }
      // }
      this._data._flow.updateResult(this._data, matched);
    }
    if (matched) {
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
    copyFromActual: (block: Block, params: {[key: string]: any; property?: string}) => {
      let property = params?.property;
      if (typeof property === 'string' && property.startsWith(EXPECT)) {
        let copyFrom = block.getProperty(`${ACTUAL}${property.substring(EXPECT.length)}`, false);
        if (copyFrom) {
          block.getProperty(property).setValue(convertActual(copyFrom._value));
        }
      }
    },
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
          {name: ACTUAL, type: 'any', pinned: true},
          {
            name: EXPECT,
            type: 'any',
            pinned: true,
            commands: {copyFromActual: {parameters: []}},
          },
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
