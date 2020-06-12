import {BlockProperty, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

class FlowTestCase extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field in FlowTestConfigGenerators) {
      return new FlowTestConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}
