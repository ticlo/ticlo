import {BlockFunction} from '../block/BlockFunction';
import {Functions} from '../block/Functions';
import {JsFunction} from '../functions/script/Js';
import {SubFlowCollector, SubFlowMode, SubFlowModeOptions} from './SubFlowFunction';
import {Flow, Root} from '../block/Flow';
import {Block} from '../block/Block';

export class SelectFlowFunction extends BlockFunction {
  collector: SubFlowCollector;

  constructor(data: Block) {
    super(data);
    // make sure collector is emitted even when there are no sync block under it
    data.getProperty('#emit');
  }

  run(): any {
    this.collector = new SubFlowCollector('selectFlow', this.onCollect);
    return this.collector;
  }

  onCollect = (block: Block) => {
    if (block._prop._name === this._data.getValue('name')) {
      block.updateValue('#subflow', 'on');
    } else {
      block.updateValue('#subflow', this._data.getValue('unusedFlow') || SubFlowMode.DISABLE);
    }
  };
}

Functions.add(SelectFlowFunction, {
  name: 'select-flow',
  icon: 'txt:js',
  priority: 2,
  properties: [
    {
      name: 'name',
      type: 'string',
      pinned: true,
    },
    {
      name: 'unusedFlow',
      type: 'radio-button',
      options: SubFlowModeOptions,
      default: SubFlowMode.DISABLE,
    },
  ],
  category: 'repeat',
});
