import mysql, {type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket} from 'mysql2/promise';
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
import {sqlColumns, validateReadonlyQuery, validateSqlTransaction} from '@ticlo/core/functions/sql/SqlClient.ts';

export interface MysqlOptions {
  connectionString: string;
  password?: string | null;
  maxConnections?: number;
  connectionTimeout?: number;
}

function connectionOptions(connectionString: string, password?: string | null) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('A MySQL connection URL is required');
  }
  if (url.protocol !== 'mysql:' || !url.hostname) throw new Error('A MySQL connection URL is required');
  if (password !== undefined && url.password) throw new Error('Put the MySQL password in #secret');
  const ssl = url.searchParams.get('ssl');
  if (url.hash || [...url.searchParams.keys()].some((key) => key !== 'ssl') || (ssl !== null && ssl !== 'true')) {
    throw new Error('The MySQL connection URL only supports the ssl=true option');
  }
  return {
    host: url.hostname.replace(/^\[(.*)\]$/, '$1'),
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    database: decodeURIComponent(url.pathname.slice(1)) || undefined,
    password: password === undefined ? decodeURIComponent(url.password) : (password ?? undefined),
    ssl: ssl ? {rejectUnauthorized: true, verifyIdentity: true} : undefined,
  };
}

function bindParams(params?: SqlParams) {
  if (params === undefined) return [];
  if (!Array.isArray(params)) throw new Error('MySQL parameters must be an array');
  return params.map((value: unknown) =>
    value instanceof Uint8Array ? Buffer.from(value.buffer, value.byteOffset, value.byteLength) : value
  );
}

type QueryTarget = Pool | PoolConnection;
const typeNames: Readonly<Partial<Record<number, string>>> = mysql.Types as unknown as Record<number, string>;

async function query(target: QueryTarget, sql: string, values: ReturnType<typeof bindParams>): Promise<SqlResult> {
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL must be a non-empty string');
  // Server-side preparation rejects batches and keeps bind values separate from SQL.
  const [rows, fields] = await target.execute<RowDataPacket[] | ResultSetHeader>({sql, values, rowsAsArray: true});
  if (Array.isArray(rows)) {
    if (!fields?.length || !fields[0]?.name) throw new Error('MySQL queries must return at most one result set');
    return {
      table: {
        columns: sqlColumns(
          fields,
          (field) => field.name,
          (field) => (field.extendedFormat ?? field.extendedTypeName ?? typeNames[field.columnType])?.toLowerCase()
        ),
        rows: (rows as unknown as unknown[][]).map((row) =>
          row.map((value) =>
            Buffer.isBuffer(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : value
          )
        ),
      },
    };
  }
  // mysql2 preserves insert IDs outside JavaScript's safe integer range as strings.
  const insertId = rows.insertId as number | string;
  return {affectedRows: Number(rows.affectedRows), insertId: Number(insertId) === 0 ? undefined : insertId};
}

export class MysqlClient implements SqlClient {
  private closing?: Promise<void>;

  private constructor(private readonly pool: Pool) {}

  static async open({
    connectionString,
    password,
    maxConnections = 10,
    connectionTimeout = 5000,
  }: MysqlOptions): Promise<MysqlClient> {
    if (!Number.isSafeInteger(maxConnections) || maxConnections < 1) {
      throw new Error('MySQL connection pool size must be a positive integer');
    }
    if (!Number.isSafeInteger(connectionTimeout) || connectionTimeout < 0 || connectionTimeout > 2147483647) {
      throw new Error('Invalid MySQL connection timeout');
    }
    const pool = mysql.createPool({
      ...connectionOptions(connectionString, password),
      connectionLimit: maxConnections,
      connectTimeout: connectionTimeout,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      multipleStatements: false,
      flags: ['-LOCAL_FILES', '-FOUND_ROWS'],
      resetOnRelease: true,
    });
    try {
      await pool.query('SELECT 1');
      return new MysqlClient(pool);
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async query(sql: string, params?: SqlParams): Promise<SqlResult> {
    return query(this.pool, sql, bindParams(params));
  }

  async queryReadonly(sql: string, params?: SqlParams): Promise<SqlResult> {
    validateReadonlyQuery(sql);
    // SELECT can also export files when the database user has the FILE privilege.
    if (/\b(?:OUTFILE|DUMPFILE)\b/i.test(sql)) throw new Error('File export is unavailable in readonly queries');
    const values = bindParams(params);
    const connection = await this.pool.getConnection();
    try {
      await connection.query('START TRANSACTION READ ONLY');
      return await query(connection, sql, values);
    } finally {
      await connection.query('ROLLBACK AND NO CHAIN').catch((error) => {
        connection.destroy();
        Logger.warn('MySQL readonly query rollback failed', error);
      });
      connection.release();
    }
  }

  async transaction(statements: readonly SqlStatement[]): Promise<SqlResult> {
    validateSqlTransaction(statements);
    const batch = statements.map(({sql, params}) => ({sql, values: bindParams(params)}));
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      let result: SqlResult;
      for (const {sql, values} of batch) result = await query(connection, sql, values);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback().catch((rollbackError) => {
        connection.destroy();
        Logger.warn('MySQL rollback failed', rollbackError);
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  async listEntities(): Promise<SqlEntity[]> {
    const [rows] = await this.pool.query<(SqlEntity & RowDataPacket)[]>(`
      SELECT TABLE_CATALOG AS catalog, TABLE_SCHEMA AS \`schema\`, TABLE_NAME AS name,
        CASE WHEN TABLE_TYPE = 'VIEW' THEN 'view' ELSE 'table' END AS kind
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    return rows;
  }

  async getColumns({catalog, schema, name}: SqlEntityRef): Promise<SqlEntityColumn[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS databaseType,
        IS_NULLABLE = 'YES' AS nullable, COLUMN_KEY AS columnKey, COLUMN_DEFAULT AS defaultExpression
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_CATALOG = COALESCE(?, 'def') AND TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
      [catalog ?? null, schema ?? null, name]
    );
    if (!rows.length) throw new Error('SQL entity is unavailable');
    return rows.map((column) => ({
      name: column.name,
      databaseType: column.databaseType,
      nullable: Boolean(column.nullable),
      primaryKey: column.columnKey === 'PRI',
      defaultExpression: column.defaultExpression ?? undefined,
    }));
  }

  close(): Promise<void> {
    return (this.closing ??= this.pool.end());
  }
}
