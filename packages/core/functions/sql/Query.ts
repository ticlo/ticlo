import {BaseFunction} from '../../block/BlockFunction.ts';
import {defaultConfigs, type PropDesc} from '../../block/Descriptor.ts';
import {NO_EMIT} from '../../block/Event.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {isDataMap} from '../../util/DataTypes.ts';
import type {SqlClient, SqlParams, SqlResult, SqlStatement} from './SqlClient.ts';

abstract class SqlRequestFunction extends BaseFunction {
  private revision = 0;

  async run() {
    const revision = ++this.revision;
    this.clearOutputs();
    const client = this._data.getValue('client') as SqlClient;
    if (!client) {
      return NO_EMIT;
    }
    const result = await this.execute(client);
    if (revision === this.revision && this._data) {
      this._data.output(result.table);
      this._data.output(result.affectedRows, 'affectedRows');
      this._data.output(result.insertId, 'insertId');
    }
  }

  protected abstract execute(client: SqlClient): Promise<SqlResult>;

  cancel() {
    // Discard stale results; canceling a block cannot undo an executed SQL write.
    ++this.revision;
    return true;
  }

  private clearOutputs() {
    this._data.output(undefined);
    this._data.output(undefined, 'affectedRows');
    this._data.output(undefined, 'insertId');
  }

  cleanup() {
    this.cancel();
    this.clearOutputs();
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

export class SqlQueryFunction extends SqlRequestFunction {
  protected execute(client: SqlClient) {
    const sql = this._data.getValue('sql');
    const params = this._data.getValue('params');
    if (typeof client?.query !== 'function') throw new Error('Invalid SQL client');
    if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL must be a non-empty string');
    if (params !== undefined && !Array.isArray(params) && !isDataMap(params)) {
      throw new Error('SQL parameters must be an array or object');
    }
    return client.query(sql, params as SqlParams);
  }
}

export class SqlTransactionFunction extends SqlRequestFunction {
  protected execute(client: SqlClient) {
    if (typeof client?.transaction !== 'function') throw new Error('SQL client does not support transactions');
    return client.transaction(this._data.getValue('statements') as SqlStatement[]);
  }
}

const clientProperty: PropDesc = {name: 'client', type: 'service', options: ['sql-client'], pinned: true};
const resultProperties: PropDesc[] = [
  {name: '#output', type: 'table', readonly: true, pinned: true},
  {name: 'affectedRows', type: 'number', readonly: true},
  {name: 'insertId', type: 'any', readonly: true},
];

globalFunctions.addFactory(SqlQueryFunction, {
  id: 'sql:query',
  name: 'query',
  category: 'sql',
  icon: '11:SQL',
  mode: 'onLoad',

  priority: 3,
  configs: defaultConfigs.concat('#cancel'),
  properties: [
    clientProperty,
    {name: 'sql', type: 'string', mime: 'sql', pinned: true},
    {name: 'params', type: 'any'},
    ...resultProperties,
  ],
});

globalFunctions.addFactory(SqlTransactionFunction, {
  id: 'sql:transaction',
  name: 'transaction',
  category: 'sql',
  icon: '11:SQL',
  mode: 'onLoad',
  priority: 3,
  configs: defaultConfigs.concat('#cancel'),
  properties: [clientProperty, {name: 'statements', type: 'array', pinned: true}, ...resultProperties],
});
