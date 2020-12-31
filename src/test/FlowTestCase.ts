import {Block, BlockFunction, BlockProperty, DataMap, Flow, Root} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';
import {WorkerFunction} from '../core/worker/WorkerFunction';
import type {AssertFunction} from './Assert';
import {updateObjectValue} from '../core/property-api/ObjectValue';
import {FunctionOutput} from '../core/block/BlockFunction';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow {
  static create(
    parent: Block,
    field: string,
    src?: DataMap,
    timeoutMs = -1,
    applyChange?: (data: DataMap) => boolean,
    onPass?: () => void,
    onFail?: () => void
  ): FlowTestCase {
    let prop = parent.getProperty(field);
    let testCase: FlowTestCase = new FlowTestCase(parent, prop, timeoutMs, onPass, onFail);

    prop.setOutput(testCase);

    let success = testCase.load(src, null, applyChange);
    if (success) {
      return testCase;
    } else {
      return null;
    }
  }

  constructor(
    parent: Block,
    property: BlockProperty,
    public timeoutMs: number,
    public onPass?: () => void,
    public onFail?: () => void
  ) {
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

  results = new Map<Block, boolean>();

  _timeout: any;
  updateResult(testBlock: Block, result: boolean | null) {
    if (this.results.get(testBlock) === result) {
      return;
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
    let waiting = 0;
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
    if (waiting > 0) {
      return;
    }
    this.clearTimeout();

    if (failed > 0) {
      updateObjectValue(this, '@b-style', {color: 'f44'});
      this.updateLabel('failed');
      this.onFail?.();
    } else {
      updateObjectValue(this, '@b-style', {color: '4b2'});
      this.updateLabel('passed');
      this.onPass?.();
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
    this.updateValue('@b-name', `${this._prop._name}-${stat}-#`);
  }
}
