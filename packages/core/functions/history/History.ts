import type {Block} from '../../block/Block.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {NO_EMIT} from '../../block/Event.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {
  toHistoryEpochMs,
  type HistoryClient,
  type HistoryRecordOptions,
  type HistorySeriesKind,
} from './HistoryClient.ts';

class HistoryFunction extends BaseFunction<Block> {
  private readSeriesId(): string {
    const rawId = this._data.getValue('id');
    const explicitId = typeof rawId === 'string' ? rawId.trim() : '';
    if (explicitId) return explicitId;
    const sourceBlock = this._data.getProperty('value', false)?._bindingSource?.getProperty()?._block;
    if (sourceBlock && sourceBlock !== this._data) {
      const sourcePath = sourceBlock.getFullPath?.();
      if (sourcePath) return sourcePath;
    }
    const parent = this._data._parent;
    if (parent && parent !== this._data) {
      const parentPath = parent.getFullPath?.();
      if (parentPath) return parentPath;
    }
    return this._data.getFullPath?.() || '';
  }

  private readInputValue(): unknown {
    const block = this._data;
    const valueProp = block.getProperty('value', false);
    if (
      block._prop?._name?.startsWith('#-') &&
      block._parent &&
      block._parent !== block &&
      (!valueProp ||
        (valueProp._bindingSource == null && valueProp._saved === undefined && valueProp.getValue() === undefined))
    ) {
      return block._parent.getValue('#output');
    }
    return block.getValue('value');
  }

  run() {
    const service = this._data.getValue('service') as HistoryClient | undefined;
    if (typeof service?.record !== 'function') {
      return NO_EMIT;
    }

    const value = this.readInputValue();
    if (value === undefined) {
      return NO_EMIT;
    }

    const id = this.readSeriesId();
    if (!id) {
      return NO_EMIT;
    }

    const rawTime = this._data.getValue('time');
    const ts = rawTime === undefined ? Date.now() : toHistoryEpochMs(rawTime);
    if (ts === undefined) {
      throw new Error('Invalid timestamp');
    }

    let options: HistoryRecordOptions | undefined;
    const kind = this._data.getValue('kind');
    if (kind === 'number' || kind === 'boolean' || kind === 'value') {
      options = {kind: kind as HistorySeriesKind};
    }

    const result = service.record(id, ts, value, options);
    if (result !== undefined) {
      return Promise.resolve(result);
    }
  }
}

globalFunctions.addFactory(HistoryFunction, {
  name: 'history',
  category: 'system',
  icon: '11:HIS',
  mode: 'onChange',
  priority: 3,
  tags: ['addon'],
  properties: [
    {name: 'service', type: 'service', options: ['history-client'], create: 'tsdb:client', pinned: true},
    {name: 'value', type: 'any', pinned: true},
    {name: 'id', type: 'string', pinned: true},
    {name: 'time', type: 'date'},
    {name: 'kind', type: 'select', options: ['auto', 'number', 'boolean', 'value'], default: 'auto'},
  ],
});
