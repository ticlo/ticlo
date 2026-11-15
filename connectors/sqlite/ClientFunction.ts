import {
  BaseFunction,
  escapedObject,
  globalFunctions,
  Logger,
  sqlClientApi,
  sqlClientCommands,
  type SqlClient,
} from '@ticlo/core';
import {resolveFilePath} from '@ticlo/node';
import '@ticlo/core/functions/sql/DatabaseCategory.ts';
import {SqliteClient} from './SqliteClient.ts';

export class SqliteClientFunction extends BaseFunction {
  private client?: SqliteClient;
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
      throw new Error(`Invalid or disallowed SQLite file path: ${rawPath}`);
    }
    const client = await SqliteClient.open({
      filePath,
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
      escapedObject<SqlClient>('database:sqlite', {
        query: client.query.bind(client),
        transaction: client.transaction.bind(client),
        listEntities: client.listEntities.bind(client),
        getColumns: client.getColumns.bind(client),
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

globalFunctions.addFactory(
  SqliteClientFunction,
  {
    name: 'sqlite',
    icon: 't11:SQ  b11^:Lite',
    mode: 'onLoad',
    priority: 2,
    tags: ['sql-client', 'context-service'],
    commands: sqlClientCommands,
    properties: [
      {name: 'filePath', type: 'file-path', pinned: true},
      {name: 'readOnly', type: 'toggle', default: false},
      {name: 'busyTimeout', type: 'number', default: 5000, min: 0, unit: 'ms'},
      {name: 'foreignKeys', type: 'toggle', default: true},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'database',
  sqlClientApi
);
