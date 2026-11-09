import {BaseFunction} from '../../block/BlockFunction.ts';
import {defaultConfigs} from '../../block/Descriptor.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {isDataMap} from '../../util/DataTypes.ts';
import type {SqlClient, SqlParams} from './SqlClient.ts';

export class SqlQueryFunction extends BaseFunction {
  private revision = 0;

  async run() {
    const revision = ++this.revision;
    this.clearOutputs();
    const client = this._data.getValue('client') as SqlClient;
    const sql = this._data.getValue('sql');
    const params = this._data.getValue('params');
    if (typeof client?.query !== 'function') {
      throw new Error('Invalid SQL client');
    }
    if (typeof sql !== 'string' || !sql.trim()) {
      throw new Error('SQL must be a non-empty string');
    }
    if (params !== undefined && !Array.isArray(params) && !isDataMap(params)) {
      throw new Error('SQL parameters must be an array or object');
    }
    const result = await client.query(sql, params as SqlParams);
    if (revision === this.revision && this._data) {
      this._data.output(result.table);
      this._data.output(result.affectedRows, 'affectedRows');
      this._data.output(result.insertId, 'insertId');
    }
  }

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

globalFunctions.addFactory(SqlQueryFunction, {
  id: 'sql:query',
  name: 'query',
  category: 'sql',
  icon: '14:SQL',
  mode: 'onCall',
  priority: 3,
  configs: defaultConfigs.concat('#cancel'),
  properties: [
    {name: 'client', type: 'service', options: ['sql-client'], pinned: true},
    {name: 'sql', type: 'string', mime: 'sql', pinned: true},
    {name: 'params', type: 'any'},
    {name: '#output', type: 'table', readonly: true, pinned: true},
    {name: 'affectedRows', type: 'number', readonly: true},
    {name: 'insertId', type: 'any', readonly: true},
  ],
});
