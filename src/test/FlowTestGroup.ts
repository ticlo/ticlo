import {Block, BlockProperty, DataMap, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';
import {TestsRunner, TestState} from './Interface';
import {updateObjectValue} from '../core/property-api/ObjectValue';
import {FlowTestConfigGenerators} from './FlowTestCase';

export const FlowTestGroupConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-group'),
};

export class FlowTestGroup extends Flow implements TestsRunner {
  constructor(parent: Block, property: BlockProperty, public timeoutMs: number, public testParent?: TestsRunner) {
    super(parent, null, property);
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowTestGroupConfigGenerators) {
      return new FlowTestGroupConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  results = new Map<Block, TestState>();

  updateTestState(testBlock: Block, result: TestState) {
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
  passed = 0;
  failed = 0;
  waiting = 0;

  run() {
    this._queueToRun = false;
    let passed = 0;
    let failed = 0;
    let waiting = 0;
    for (let [block, state] of this.results) {
      if (block instanceof FlowTestGroup) {
        passed += block.passed;
        failed += block.failed;
        waiting += block.waiting;
      } else {
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
    }
    if (passed !== this.passed || failed !== this.failed || waiting !== this.waiting) {
      this.passed = passed;
      this.failed = failed;
      this.waiting = waiting;
      let detail = ` ${passed} / ${passed + failed + waiting}`;
      if (waiting > 0) {
        updateObjectValue(this, '@b-style', {color: 'f44', detail});
        this.updateLabel('running');
      }
      if (failed > 0) {
        updateObjectValue(this, '@b-style', {color: 'f44', detail});
        this.updateLabel('failed');
        this.testParent?.updateTestState(this, TestState.FAILED);
      } else {
        updateObjectValue(this, '@b-style', {color: '4b2', detail});
        this.updateLabel('passed');
        this.testParent?.updateTestState(this, TestState.PASSED);
      }
    }
  }

  destroy() {
    this.testParent?.updateTestState(this, TestState.REMOVED);
  }

  updateLabel(stat: string) {
    this.updateValue('@b-name', `${this._prop._name}-${stat}-#`);
  }
}
