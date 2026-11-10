import {BaseFunction, escapedObject, globalFunctions, Logger, type SqlClient} from '@ticlo/core';
import {SqliteClient} from './SqliteClient.ts';

export class SqliteClientFunction extends BaseFunction {
  private client?: SqliteClient;
  private revision = 0;

  async run() {
    const revision = ++this.revision;
    this.release();
    this._data.output(undefined);
    const client = await SqliteClient.open({
      filePath: this._data.getValue('filePath') as string,
      readOnly: Boolean(this._data.getValue('readOnly')),
      busyTimeout: (this._data.getValue('busyTimeout') as number) ?? 5000,
      foreignKeys: this._data.getValue('foreignKeys') !== false,
    });
    if (revision !== this.revision || !this._data) {
      await client.close();
      return;
    }
    this.client = client;
    this._data.output(
      escapedObject<SqlClient>('sqlite:client', {
        query: client.query.bind(client),
      })
    );
  }

  cancel() {
    ++this.revision;
    return true;
  }

  private release() {
    if (this.client) {
      void this.client.close().catch((error) => Logger.error('Unable to close SQLite client', error));
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

globalFunctions.addCategory({
  id: 'sqlite',
  name: 'sqlite',
  libraryId: 'sqlite',
  icon: 't11:SQ  b11^:Lite',
  color: '4af',
});
globalFunctions.addFactory(
  SqliteClientFunction,
  {
    name: 'client',
    icon: 't11:SQ  b11^:Lite',
    mode: 'onLoad',
    priority: 2,
    tags: ['sql-client'],
    properties: [
      {name: 'filePath', type: 'string', pinned: true},
      {name: 'readOnly', type: 'toggle', default: false},
      {name: 'busyTimeout', type: 'number', default: 5000, min: 0, unit: 'ms'},
      {name: 'foreignKeys', type: 'toggle', default: true},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'sqlite'
);
