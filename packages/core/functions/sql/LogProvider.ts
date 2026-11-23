import {PureFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {escapedObject} from '../../util/NoSerialize.ts';
import {encode} from '../../util/Serialize.ts';
import type {LogProvider} from '../system/Log.ts';
import type {SqlClient, SqlResult} from './SqlClient.ts';

// Share table setup across providers for the lifetime of the client.
const tablesByClient = new WeakMap<SqlClient, Map<string, Promise<SqlResult>>>();

function createProvider(client: SqlClient, name: string): LogProvider {
  const {dialect} = client;
  if (!['sqlite', 'postgres', 'mysql'].includes(dialect) || typeof client.query !== 'function') {
    throw new Error('SQL log provider requires a SQLite, PostgreSQL or MySQL client');
  }
  if (typeof name !== 'string' || !name.trim() || name.includes('\0')) throw new Error('Invalid SQL log table name');
  if (dialect === 'postgres' && new TextEncoder().encode(name).length > 63) {
    throw new Error('PostgreSQL log table names cannot exceed 63 bytes');
  }

  const quote = dialect === 'mysql' ? '`' : '"';
  const table = quote + name.replaceAll(quote, quote + quote) + quote;
  const columns = 'time, level, message, block_path, origin_path, data';
  const params = dialect === 'postgres' ? '$1, $2, $3, $4, $5, $6' : '?, ?, ?, ?, ?, ?';
  const text = dialect === 'mysql' ? 'LONGTEXT' : 'TEXT';
  const create = `CREATE TABLE IF NOT EXISTS ${table} (
    time BIGINT NOT NULL, level VARCHAR(8) NOT NULL, message ${text} NOT NULL,
    block_path TEXT, origin_path TEXT, data ${text}
  )`;
  const insert = `INSERT INTO ${table} (${columns}) VALUES (${params})`;
  let tables = tablesByClient.get(client);
  if (!tables) {
    tables = new Map();
    tablesByClient.set(client, tables);
  }

  function ensureTable() {
    let ready = tables.get(name);
    if (!ready) {
      ready = client.query(create).catch((error) => {
        tables.delete(name);
        throw error;
      });
      tables.set(name, ready);
    }
    return ready;
  }

  return escapedObject<LogProvider>('sql:log-provider', {
    async write({time, level, message, blockPath, originPath, data}) {
      const values = [
        time,
        level,
        message,
        blockPath ?? null,
        originPath ?? null,
        data === undefined ? null : encode(data),
      ];
      const ready = ensureTable();
      await ready;
      try {
        await client.query(insert, values);
      } catch (error) {
        // Only a missing table warrants retrying an INSERT. Other failures may have committed.
        if (!isMissingTable(error, dialect, name)) throw error;
        if (tables.get(name) === ready) tables.delete(name);
        await ensureTable();
        await client.query(insert, values);
      }
    },
  });
}

function isMissingTable(error: unknown, dialect: SqlClient['dialect'], name: string) {
  const failure = error as {code?: string; message?: string; position?: string; sqlMessage?: string};
  // A missing relation inside a trigger is a different failure from a missing INSERT target.
  if (dialect === 'postgres')
    return failure?.code === '42P01' && failure.position === String('INSERT INTO '.length + 1);
  if (dialect === 'mysql') return failure?.code === 'ER_NO_SUCH_TABLE' && failure.sqlMessage?.includes(`.${name}'`);
  return failure?.code === 'ERR_SQLITE_ERROR' && failure.message === `no such table: ${name}`;
}

class SqlLogProviderFunction extends PureFunction {
  run() {
    const client = this._data.getValue('client') as SqlClient;
    const name = this._data.getValue('tableName') as string | undefined;
    try {
      this._data.output(client ? createProvider(client, name ?? 'ticlo_log') : undefined);
    } catch (error) {
      this._data.output(undefined);
      throw error;
    }
  }
}

globalFunctions.addFactory(SqlLogProviderFunction, {
  id: 'sql:log-provider',
  name: 'log-provider',
  category: 'sql',
  icon: '11:SQL',
  tags: ['log-provider', 'context-service'],
  mode: 'onLoad',
  priority: 2,
  properties: [
    {name: 'client', type: 'service', options: ['sql-client'], pinned: true},
    {name: 'tableName', type: 'string', default: 'ticlo_log', pinned: true},
    {name: '#output', type: 'object', readonly: true, pinned: true},
  ],
});
