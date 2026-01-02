import {
  Block,
  StatefulFunction,
  BlockIO,
  decode,
  encode,
  Event,
  EventType,
  NO_EMIT,
  BaseFunction,
  globalFunctions,
} from '@ticlo/core';
import {deepEqual} from '@ticlo/core/util/Compare.js';
import {isPrimitiveType} from '@ticlo/core/util/DataTypes.js';
import {updateObjectValue} from '@ticlo/core/property-api/ObjectValue.js';
import {FlowTestCase} from './FlowTestCase.js';
import {TestState} from './Interface.js';
import {getInputsArray} from '@ticlo/core/block/FunctonData.js';

const EXPECT = 'expect';
const ACTUAL = 'actual';
const FAULT = 'fault';

function convertActual(actual: any) {
  if (isPrimitiveType(actual) || Array.isArray(actual) || actual.constructor === Object) {
    return actual;
  }
  return decode(encode(actual));
}

export class AssertFunction extends BaseFunction<Block> {
  _state: TestState;
  _calledSync = false;
  _alwaysMatch = false;

  onCall(val: any): boolean {
    if (Event.check(val) === EventType.TRIGGER) {
      this.changeTestState(TestState.RUNNING);
      this._data.deleteValue('@b-style');

      if (this._data._sync) {
        if (this._calledSync && !this._alwaysMatch) {
          // in sync mode, match once must match the first test, and after that any trigger would be ignored
          return false;
        }
        this._calledSync = true;
        // called as sync block, but still put into queue instead of running at once
        this._data._queueFunction();
        return false;
      }
    }

    return super.onCall(val);
  }

  inputChanged(input: BlockIO, val: any): boolean {
    if (input._name === 'matchMode') {
      this._alwaysMatch = Boolean(input._value);
    }
    if (this._data._sync && !this._calledSync) {
      return false;
    }
    if (this._state === TestState.PASSED && !this._alwaysMatch) {
      return false;
    }
    return true;
  }
  changeTestState(state: TestState) {
    if (state !== this._state) {
      this._state = state;
      this.notifyParent();
    }
  }
  notifyParent() {
    if (this._data._flow instanceof FlowTestCase) {
      // let message: string = null;
      // if (!matched) {
      //   message = this._data.getValue('@b-name');
      //   if (!message || typeof message !== 'string') {
      //     message = this._data._prop._name;
      //   }
      // }
      this._data._flow.updateTestState(this._data, this._state);
    }
  }
  run(): any {
    if (this._state === TestState.PASSED && !this._alwaysMatch) {
      return NO_EMIT;
    }
    const compares = getInputsArray(this._data, '', 1, [EXPECT, ACTUAL]) as {
      expect: any;
      actual: any;
    }[];
    let matched = compares.length > 0;
    for (let i = 0; i < compares.length; ++i) {
      const {expect, actual} = compares[i];
      if (actual === undefined) {
        // ignore when input is undefined
        return NO_EMIT;
      }
      if (!deepEqual(actual, expect)) {
        matched = false;
        this._data.output(actual, `${FAULT}${i}`);
        break;
      }
    }
    this.changeTestState(matched ? TestState.PASSED : TestState.FAILED);
    this._data.output(matched);

    if (matched) {
      updateObjectValue(this._data, '@b-style', {color: '4b2'});
    } else {
      updateObjectValue(this._data, '@b-style', {color: 'f44'});
      return NO_EMIT;
    }
  }
  cleanup(): void {
    this._data.deleteValue('@b-style');
    this.changeTestState(TestState.REMOVED);
  }
}

const API = {
  commands: {
    copyFromActual: (block: Block, params: {[key: string]: any; property?: string}) => {
      const property = params?.property;
      if (typeof property === 'string' && property.startsWith(EXPECT)) {
        const copyFrom = block.getProperty(`${ACTUAL}${property.substring(EXPECT.length)}`, false);
        if (copyFrom) {
          block.getProperty(property).setValue(convertActual(copyFrom._value));
        }
      }
    },
  },
};

globalFunctions.add(
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
          {name: FAULT, type: 'any', readonly: true},
        ],
      },
      {name: 'matchMode', type: 'radio-button', options: ['match-once', 'always-match'], default: 'match-once'},
      {name: '#output', type: 'toggle', readonly: true, pinned: false},
    ],
    dynamicStyle: true,
  },
  'test',
  API
);
