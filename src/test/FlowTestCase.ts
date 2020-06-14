import {Block, BlockProperty, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field in FlowTestConfigGenerators) {
      return new FlowTestConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  results = new Map<Block, string>();

  updateResult(testBlock: Block, result: string) {
    if (this.results.get(testBlock) === result) {
      return;
    }
    this.results.set(testBlock, result);
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
  }
}
