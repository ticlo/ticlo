import {BlockProperty, Flow} from '../core';
import {ConstTypeConfig, FlowConfigGenerators} from '../core/block/BlockConfigs';
import {BlockConfig} from '../core/block/BlockProperty';

export const FlowTestGroupConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-group'),
};
class FlowTestGroup extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field in FlowTestGroupConfigGenerators) {
      return new FlowTestGroupConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}
