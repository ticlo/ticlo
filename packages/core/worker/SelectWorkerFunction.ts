import {BaseFunction, StatefulFunction} from '../block/BlockFunction';
import {Functions} from '../block/Functions';
import {JsFunction} from '../functions/script/Js';
import {WorkerCollector, WorkerMode, WorkerModeOptions} from './WorkerFunction';
import {Flow, Root} from '../block/Flow';
import {Block} from '../block/Block';

export class SelectWorkerFunction extends BaseFunction<Block> {
  collector: WorkerCollector;

  constructor(data: Block) {
    super(data);
    // make sure collector is emitted even when there are no sync block under it
    data.getProperty('#emit');
  }

  run(): any {
    this.collector = new WorkerCollector('selectFlow', this.onCollect);
    return this.collector;
  }

  onCollect = (block: Block) => {
    if (block._prop._name === this._data.getValue('name')) {
      block.updateValue('#state', 'on');
    } else {
      block.updateValue('#state', this._data.getValue('unusedFlow') || WorkerMode.DISABLE);
    }
  };
}

Functions.add(SelectWorkerFunction, {
  name: 'select-worker',
  icon: 'fas:file-circle-question',
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
      options: WorkerModeOptions,
      default: WorkerMode.DISABLE,
    },
  ],
  category: 'repeat',
});
