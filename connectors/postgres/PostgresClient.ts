import pg from 'pg';
import {parseIntoClientConfig} from 'pg-connection-string';
import {
  Logger,
  type SqlClient,
  type SqlEntity,
  type SqlEntityColumn,
  type SqlEntityRef,
  type SqlParams,
  type SqlResult,
  type SqlStatement,
} from '@ticlo/core';
import {sqlColumns, validateSqlTransaction} from '@ticlo/core/functions/sql/SqlClient.ts';

export interface PostgresOptions {
  connectionString: string;
  password?: string;
  maxConnections?: number;
  connectionTimeout?: number;
  statementTimeout?: number;
}

const {Pool, types} = pg;

function connectionOptions(connectionString: string, password?: string): pg.ClientConfig {
  if (password === undefined) return {connectionString};
  const {
    host,
    port,
    database,
    user,
    ssl,
    sslnegotiation,
    application_name,
    fallback_application_name,
    options,
    client_encoding,
    password: urlPassword,
  } = parseIntoClientConfig(connectionString);
  if (urlPassword) throw new Error('Put the PostgreSQL password in #secret');
  return {
    host,
    port,
    database,
    user,
    ssl,
    sslnegotiation,
    application_name,
    fallback_application_name,
    options,
    client_encoding,
    password,
  };
}
const {BYTEA, DATE, INT8, NUMERIC, TIMESTAMP, TIMESTAMPTZ, INTERVAL} = types.builtins;
const typeNames = new Map(Object.entries(types.builtins).map(([name, oid]) => [oid, name.toLowerCase()]));
// Keep exact values and their temporal/numeric array forms in PostgreSQL's text representation.
const textTypes = new Set<number>([
  DATE,
  INT8,
  NUMERIC,
  TIMESTAMP,
  TIMESTAMPTZ,
  INTERVAL,
  1115,
  1182,
  1185,
  1187,
  1231,
]);
const parseBytea = types.getTypeParser(BYTEA);
const parsers: pg.CustomTypesConfig = {
  getTypeParser(oid, format) {
    if (textTypes.has(oid)) return (value: string) => value;
    if (oid === BYTEA) {
      return (value: string) => {
        const buffer: Buffer = parseBytea(value);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      };
    }
    return types.getTypeParser(oid, format);
  },
};

const entities = `
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace`;
const accessible = `
  c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname !~ '^pg_'
  AND n.nspname <> 'information_schema'
  AND has_schema_privilege(n.oid, 'USAGE')
  AND (
    has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    OR has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
  )`;

async function query(connection: pg.PoolClient, sql: string, params?: SqlParams): Promise<SqlResult> {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL must be a non-empty string');
  if (params !== undefined && !Array.isArray(params)) throw new Error('PostgreSQL parameters must be an array');
  // The extended protocol rejects multiple statements before execution, even without parameters.
  const config = {text: sql, values: params, rowMode: 'array' as const, queryMode: 'extended', types: parsers};
  const {fields, rows, command, rowCount} = await connection.query<unknown[]>(config);
  const result: SqlResult = {};
  if (fields.length) {
    result.table = {
      columns: sqlColumns(
        fields,
        (field) => field.name,
        (field) => typeNames.get(field.dataTypeID)
      ),
      rows,
    };
  }
  if (rowCount !== null && /^(?:INSERT|UPDATE|DELETE|MERGE)$/.test(command)) result.affectedRows = rowCount;
  return result;
}

export class PostgresClient implements SqlClient {
  private closing?: Promise<void>;

  private constructor(private readonly pool: pg.Pool) {}

  static async open({
    connectionString,
    password,
    maxConnections = 10,
    connectionTimeout = 5000,
    statementTimeout = 30000,
  }: PostgresOptions): Promise<PostgresClient> {
    if (typeof connectionString !== 'string' || !/^postgres(?:ql)?:\/\//.test(connectionString)) {
      throw new Error('A PostgreSQL connection URL is required');
    }
    if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) {
      throw new Error('PostgreSQL connection pool size must be a positive integer');
    }
    if (
      !Number.isSafeInteger(connectionTimeout) ||
      connectionTimeout < 0 ||
      connectionTimeout > 2147483647 ||
      !Number.isSafeInteger(statementTimeout) ||
      statementTimeout < 0 ||
      statementTimeout > 2147483647
    ) {
      throw new Error('Invalid PostgreSQL timeout');
    }
    const pool = new Pool({
      ...connectionOptions(connectionString, password),
      max: maxConnections,
      connectionTimeoutMillis: connectionTimeout,
      statement_timeout: statementTimeout,
    });
    pool.on('error', (error) => Logger.warn('Idle PostgreSQL connection failed', error));
    try {
      await pool.query('SELECT 1');
      return new PostgresClient(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async query(sql: string, params?: SqlParams): Promise<SqlResult> {
    const connection = await this.pool.connect();
    try {
      const result = await query(connection, sql, params);
      if (connection.getTransactionStatus() !== 'I')
        throw new Error('Use sql:transaction to run a PostgreSQL transaction');
      return result;
    } finally {
      connection.release(connection.getTransactionStatus() !== 'I');
    }
  }

  async transaction(statements: readonly SqlStatement[]): Promise<SqlResult> {
    validateSqlTransaction(statements);
    const batch = statements.map(({sql, params}) => {
      if (Array.isArray(params)) return {sql, params: params.slice()};
      if (params === undefined) return {sql};
      throw new Error('PostgreSQL parameters must be an array');
    });
    const connection = await this.pool.connect();
    try {
      await connection.query('BEGIN');
      let result: SqlResult;
      for (const {sql, params} of batch) result = await query(connection, sql, params);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      if (connection.getTransactionStatus() !== 'I') {
        await connection
          .query('ROLLBACK')
          .catch((rollbackError) => Logger.warn('PostgreSQL rollback failed', rollbackError));
      }
      throw error;
    } finally {
      connection.release(connection.getTransactionStatus() !== 'I');
    }
  }

  async listEntities(): Promise<SqlEntity[]> {
    const {rows} = await this.pool.query<SqlEntity>(`
      SELECT current_database() AS catalog, n.nspname AS schema, c.relname AS name,
        CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind
      ${entities}
      WHERE ${accessible}
      ORDER BY n.nspname, c.relname
    `);
    return rows;
  }

  async getColumns({catalog, schema, name}: SqlEntityRef): Promise<SqlEntityColumn[]> {
    const {rows} = await this.pool.query<{
      name: string | null;
      databaseType: string;
      nullable: boolean;
      primaryKey: boolean;
      defaultExpression: string | null;
    }>(
      `
      SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS "databaseType",
        NOT a.attnotnull AS nullable,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint p
          WHERE p.conrelid = c.oid AND p.contype = 'p' AND a.attnum = ANY(p.conkey)
        ) AS "primaryKey",
        pg_get_expr(d.adbin, d.adrelid) AS "defaultExpression"
      ${entities}
      LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        AND has_column_privilege(c.oid, a.attnum, 'SELECT, INSERT, UPDATE, REFERENCES')
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE ${accessible}
        AND ($1::text IS NULL OR $1 = current_database())
        AND CASE WHEN $2::text IS NULL THEN pg_table_is_visible(c.oid) ELSE n.nspname = $2 END
        AND c.relname = $3
      ORDER BY a.attnum
    `,
      [catalog, schema, name]
    );
    if (!rows.length) throw new Error('SQL entity is unavailable');
    if (rows[0].name === null) return [];
    return rows.map((column) => ({
      name: column.name,
      databaseType: column.databaseType,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      defaultExpression: column.defaultExpression ?? undefined,
    }));
  }

  close(): Promise<void> {
    return (this.closing ??= this.pool.end());
  }
}
