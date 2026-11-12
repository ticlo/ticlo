import {
  BaseFunction,
  configDescs,
  escapedObject,
  globalFunctions,
  Logger,
  sqlClientApi,
  sqlClientCommands,
  type Block,
  type BlockConfig,
  type SqlClient,
} from '@ticlo/core';
import {PostgresClient} from './PostgresClient.ts';

class PostgresClientFunction extends BaseFunction<Block> {
  private client?: PostgresClient;
  private revision = 0;

  async run() {
    const revision = ++this.revision;
    this.release();
    this._data.output(undefined);
    const client = await PostgresClient.open({
      connectionString: this._data.getValue('connectionString') as string,
      password: this._data._getSecret(this) ?? '',
      maxConnections: this._data.getValue('maxConnections') as number | undefined,
      connectionTimeout: this._data.getValue('connectionTimeout') as number | undefined,
      statementTimeout: this._data.getValue('statementTimeout') as number | undefined,
    });
    if (revision !== this.revision || !this._data) {
      await client.close();
      return;
    }
    this.client = client;
    this._data.output(
      escapedObject<SqlClient>('postgres:client', {
        query: client.query.bind(client),
        transaction: client.transaction.bind(client),
        listEntities: client.listEntities.bind(client),
        getColumns: client.getColumns.bind(client),
      })
    );
  }

  configChanged(config: BlockConfig) {
    return config.getName() === '#secret';
  }

  cancel() {
    ++this.revision;
    return true;
  }

  private release() {
    if (this.client) {
      void this.client.close().catch((error) => Logger.error('Unable to close PostgreSQL client', error));
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
  id: 'postgres',
  name: 'postgres',
  libraryId: 'postgres',
  icon: '15:PG',
  color: '36a',
});
globalFunctions.addFactory(
  PostgresClientFunction,
  {
    name: 'client',
    icon: '15:PG',
    mode: 'onLoad',
    priority: 2,
    tags: ['sql-client'],
    commands: sqlClientCommands,
    properties: [
      {name: 'connectionString', type: 'string', pinned: true},
      configDescs['#secret'],
      {name: 'maxConnections', type: 'number', default: 10, min: 1},
      {name: 'connectionTimeout', type: 'number', default: 5000, min: 0, unit: 'ms'},
      {name: 'statementTimeout', type: 'number', default: 30000, min: 0, unit: 'ms'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'postgres',
  sqlClientApi
);
