import {
  BaseFunction,
  escapedObject,
  globalFunctions,
  historyClientApi,
  historyClientCommands,
  Logger,
  type HistoryClient,
} from '@ticlo/core';
import {resolveFilePath} from '@ticlo/node';
import '@ticlo/core/functions/sql/DatabaseCategory.ts';
import {TsdbClient} from './TsdbClient.ts';

export class TsdbClientFunction extends BaseFunction {
  private client?: TsdbClient;
  private revision = 0;

  async run() {
    const revision = ++this.revision;
    this.release();
    this._data.output(undefined);

    const rawPath = this._data.getValue('filePath') as string;
    const filePath = rawPath === ':memory:' ? rawPath : rawPath ? await resolveFilePath(this._data, rawPath) : '';
    if (revision !== this.revision || !this._data) {
      return;
    }
    if (rawPath && !filePath) {
      throw new Error(`Invalid or disallowed TSDB path: ${rawPath}`);
    }

    const client = await TsdbClient.open({
      filePath,
      timezone: this._data.getValue('timezone') as string | undefined,
      raw: this._data.getValue('raw') !== false,
      rollup15s: Boolean(this._data.getValue('rollup15s')),
      rollup5m: Boolean(this._data.getValue('rollup5m')),
      rollup1h: this._data.getValue('rollup1h') !== false,
      rollup1d: this._data.getValue('rollup1d') !== false,
      rawNumericMaxMB: this._data.getValue('rawNumericMaxMB') as number | undefined,
      rawValueMaxMB: this._data.getValue('rawValueMaxMB') as number | undefined,
      rollupMaxMB: this._data.getValue('rollupMaxMB') as number | undefined,
    });
    if (revision !== this.revision || !this._data) {
      await client.close();
      return;
    }
    this.client = client;
    this._data.output(
      escapedObject<HistoryClient>('tsdb:client', {
        timezone: client.timezone,
        record: client.record.bind(client),
        markInterruption: client.markInterruption.bind(client),
        listSeries: client.listSeries.bind(client),
        query: client.query.bind(client),
        deleteSeries: client.deleteSeries.bind(client),
      })
    );
  }

  cancel() {
    ++this.revision;
    return true;
  }

  private release() {
    if (this.client) {
      void this.client.close().catch((error) => Logger.error('Unable to close TSDB client', error));
      this.client = undefined;
    }
  }

  cleanup() {
    this.cancel();
    this.release();
    this._data.output(undefined);
  }

  destroy() {
    this.cancel();
    this.release();
    super.destroy();
  }
}

globalFunctions.addFactory(
  TsdbClientFunction,
  {
    name: 'client',
    category: 'database',
    useFullName: true,
    icon: '11:TSDB',
    mode: 'onLoad',
    priority: 2,
    tags: ['history-client', 'context-service'],
    commands: historyClientCommands,
    properties: [
      {name: 'filePath', type: 'file-path', pinned: true},
      {name: 'timezone', type: 'string'},
      {name: 'raw', type: 'toggle', default: true},
      {name: 'rollup15s', type: 'toggle', default: false},
      {name: 'rollup5m', type: 'toggle', default: false},
      {name: 'rollup1h', type: 'toggle', default: true},
      {name: 'rollup1d', type: 'toggle', default: true},
      {name: 'rawNumericMaxMB', type: 'number', min: 0, unit: 'MB'},
      {name: 'rawValueMaxMB', type: 'number', min: 0, unit: 'MB'},
      {name: 'rollupMaxMB', type: 'number', min: 0, unit: 'MB'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'tsdb',
  historyClientApi
);
