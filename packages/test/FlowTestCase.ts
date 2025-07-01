import {Block, BlockIO, BlockProperty, DataMap, Flow, Functions} from '@ticlo/core';
import {ConstTypeConfig, FlowConfigGenerators} from '@ticlo/core/block/BlockConfigs';
import {BlockConfig} from '@ticlo/core/block/BlockProperty';
import {updateObjectValue} from '@ticlo/core/property-api/ObjectValue';
import {FlowState} from '@ticlo/core/block/Flow';
import {TestsRunner, TestState} from './Interface';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow implements TestsRunner {
  constructor(
    parent: Block,
    property: BlockProperty,
    public timeoutMs: number,
    public testParent?: TestsRunner
  ) {
    super(parent, null, property);
  }

  onPassed: (testcase: FlowTestCase) => void;
  onFailed: (testcase: FlowTestCase) => void;
  start(onPassed?: (testcase: FlowTestCase) => void, onFailed?: (testcase: FlowTestCase) => void) {
    // Set #disabled to true first to clear all the cache.
    this.updateValue('#disabled', true);
    this.onPassed = onPassed;
    this.onFailed = onFailed;
    this.clearTimeout();
    if (this.timeoutMs > 0) {
      this._timeout = setTimeout(this.onTimeout, this.timeoutMs);
    }
    this.updateLabel('running');
    this.deleteValue('@b-style');
    // Clear #disabled to restart the test.
    this.updateValue('#disabled', undefined);
  }

  load(
    src: DataMap,
    funcId?: string,
    applyChange?: (data: DataMap) => boolean,
    onStateChange?: (flow: Flow, state: FlowState) => void
  ): boolean {
    let loaded = super.load(src, funcId, applyChange, onStateChange);
    this.results.clear();
    this.forEach((field: string, value: unknown, prop: BlockIO) => {
      if (value instanceof Block && value.getValue('#is') === 'test:assert') {
        this.results.set(value, TestState.NEW);
      }
    });
    return loaded;
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
  _pending: any = null;
  updateTestState(testBlock: Block, result: TestState) {
    if (this.results.get(testBlock) === result) {
      return;
    }
    if (result === TestState.REMOVED) {
      this.results.delete(testBlock);
    } else {
      this.results.set(testBlock, result);
    }
    if (!this._pending) {
      this._pending = setTimeout(this.queueFunction, 0);
    }
  }
  // bind _queueFunction with arrow function
  queueFunction = () => {
    this._pending = null;
    if (!this._disabled) {
      this._queueFunction();
    }
  };

  getPriority(): number {
    if (this._controlPriority >= 0) {
      return this._controlPriority;
    }
    return 3;
  }
  run() {
    this._queueToRun = false;
    if (!this._timeouted) {
      let waiting = this.findFirst((field: string, value: unknown, prop: BlockIO) => {
        if (value instanceof Block && value._waiting) {
          // return anything !== undefined is enough
          return true;
        }
      });
      if (waiting) {
        return;
      }
    }
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
      this.onFailed?.(this);
    } else {
      updateObjectValue(this, '@b-style', {color: '4b2'});
      this.updateLabel('passed');
      this.testParent?.updateTestState(this, TestState.PASSED);
      this.onPassed?.(this);
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
    if (!this._pending) {
      clearTimeout(this._pending);
    }
    this.clearTimeout();
    this.testParent?.updateTestState(this, TestState.REMOVED);
  }

  updateLabel(stat: string) {
    this.updateValue('@b-name', `${this._prop._name}-${stat}-#`);
  }

  executeCommand(command: string, params: DataMap): DataMap {
    switch (command) {
      case 'start': {
        this.start();
        break;
      }
    }
    return null;
  }
}
