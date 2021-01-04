import {Block, BlockProperty, DataMap, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';
import type {AssertFunction} from './Assert';
import {updateObjectValue} from '../core/property-api/ObjectValue';
import {TestsRunner, TestState} from './Interface';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow implements TestsRunner {
  constructor(parent: Block, property: BlockProperty, public timeoutMs: number, public testParent?: TestsRunner) {
    super(parent, null, property);
    if (this.timeoutMs > 0) {
      this._timeout = setTimeout(this.onTimeout, timeoutMs);
      this.updateLabel('running');
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowTestConfigGenerators) {
      return new FlowTestConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  results = new Map<Block, TestState>();

  _timeout: any;
  _timeouted = false;
  updateTestState(testBlock: Block, result: TestState) {
    if (this.results.get(testBlock) === result) {
      return;
    }
    if (result === TestState.REMOVED) {
      this.results.delete(testBlock);
    } else {
      this.results.set(testBlock, result);
    }

    this._queueFunction();
  }

  getPriority(): number {
    if (this._controlPriority >= 0) {
      return this._controlPriority;
    }
    return 3;
  }
  run() {
    this._queueToRun = false;
    let passed = 0;
    let failed = 0;
    let waiting = 0;
    for (let [block, state] of this.results) {
      switch (state) {
        case TestState.PASSED: {
          ++passed;
          break;
        }
        case TestState.FAILED: {
          ++failed;
          break;
        }
        case TestState.NEW:
        case TestState.RUNNING: {
          ++waiting;
          break;
        }
        // case TestState.DISABLED:
        default: {
          // void
        }
      }
    }
    if (waiting > 0 && !this._timeouted) {
      return;
    }
    this.clearTimeout();

    if (failed > 0 || this._timeouted) {
      updateObjectValue(this, '@b-style', {color: 'f44'});
      this.updateLabel('failed');
      this.testParent?.updateTestState(this, TestState.FAILED);
    } else {
      updateObjectValue(this, '@b-style', {color: '4b2'});
      this.updateLabel('passed');
      this.testParent?.updateTestState(this, TestState.PASSED);
    }
  }
  onTimeout = () => {
    this._timeout = null;
    this._timeouted = true;
    this._queueFunction();
  };
  clearTimeout() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }
  destroy() {
    this.clearTimeout();
    this.testParent?.updateTestState(this, TestState.REMOVED);
  }

  updateLabel(stat: string) {
    this.updateValue('@b-name', `${this._prop._name}-${stat}-#`);
  }
}
