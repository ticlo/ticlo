import {Block, BlockFunction, BlockProperty, DataMap, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';
import {WorkerFunction} from '../core/worker/WorkerFunction';
import type {AssertFunction} from './Assert';
import {updateObjectValue} from '../core/property-api/ObjectValue';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow {
  static timeoutMs = 1000;
  static create(
    parent: Block,
    field: string,
    src?: DataMap,
    forceLoad = false,
    applyChange?: (data: DataMap) => boolean
  ): FlowTestCase {
    let prop = parent.getProperty(field);
    let testCase: FlowTestCase = new FlowTestCase(parent, null, prop);

    prop.setOutput(testCase);

    let success = testCase.load(src, null, applyChange);
    if (success) {
      return testCase;
    } else {
      return null;
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowTestConfigGenerators) {
      return new FlowTestConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  results = new Map<Block, boolean>();

  _timeout: any;
  updateResult(testBlock: Block, result: boolean | null) {
    if (this.results.get(testBlock) === result) {
      return;
    }
    if (!this._timeout) {
      this._timeout = setTimeout(this.onTimeout, FlowTestCase.timeoutMs);
    }
    if (result == null) {
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
    for (let [block, msg] of this.results) {
      let f = block._function;
      if (f) {
        if ((f as AssertFunction)._matched) {
          ++passed;
        } else {
          ++failed;
        }
      }
    }
    if (failed > 0) {
      if (!this._timeout) {
        updateObjectValue(this, '@b-style', {color: 'f44'});
        this.updateLabel('failed');
      } else {
        this.updateLabel('running');
      }
    } else {
      this.clearTimeout();
      updateObjectValue(this, '@b-style', {color: '4b2'});
      this.updateLabel('passed');
    }
  }
  onTimeout = () => {
    this._timeout = null;
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
    if (this._flow instanceof FlowTestCase) {
      this._flow.updateResult(this, null);
    }
  }

  updateLabel(stat: string) {
    this.setValue('@b-name', `${this._prop._name}-${stat}-#`);
  }
}
