import './Block';
import {Flow, Root} from './Flow';
import {BlockConfig, BlockProperty} from './BlockProperty';
import {ConstTypeConfig, FlowConfigGenerators} from './BlockConfigs';
import {DataMap} from '../util/DataTypes';

export const FlowSubConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:sub'),
};

class FlowSub extends Flow {
  _save(): DataMap {
    return this.getValue('@b-xyw');
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowSubConfigGenerators) {
      return new FlowSubConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}

Root.defaultCreateFlow = (path: string, prop: BlockProperty) => {
  if (path.includes('.')) {
    return new FlowSub(prop._block, null, prop);
  } else {
    return new Flow(prop._block, null, prop);
  }
};
