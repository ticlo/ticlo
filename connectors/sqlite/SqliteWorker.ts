import {parentPort} from 'node:worker_threads';
import {DatabaseSync, type SQLInputValue, type StatementSync} from 'node:sqlite';
import type {SqlParams, SqlResult, SqlEntity, SqlEntityRef, SqlEntityColumn, SqlStatement} from '@ticlo/core';
import {sqlColumns, validateSqlTransaction} from '@ticlo/core/functions/sql/SqlClient.ts';
import type {SqliteRequest} from './SqliteClient.ts';

let database: DatabaseSync;
let metadata: StatementSync;

function transportInteger(value: bigint): number | string {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : value.toString();
}

function closeStatement(statement: StatementSync) {
  // Explicit finalization is available on newer Node 24 releases.
  (statement as StatementSync & {close?: () => void})?.close?.();
}

function bindValue(value: unknown) {
  return typeof value === 'boolean' ? Number(value) : value;
}

function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}

function listEntities(): SqlEntity[] {
  const schemas = database.prepare('PRAGMA database_list');
  try {
    return (schemas.all() as {name: string}[]).flatMap(({name: schema}) => {
      const statement = database.prepare(
        `SELECT name, type AS kind FROM ${quoteIdentifier(schema)}.sqlite_schema ` +
          "WHERE type IN ('table', 'view') AND name NOT GLOB 'sqlite_*' ORDER BY name"
      );
      try {
        return (statement.all() as {name: string; kind: 'table' | 'view'}[]).map((entity) => ({...entity, schema}));
      } finally {
        closeStatement(statement);
      }
    });
  } finally {
    closeStatement(schemas);
  }
}

function getColumns(entity: SqlEntityRef): SqlEntityColumn[] {
  if (entity.catalog !== undefined) throw new Error('SQLite does not support catalogs');
  const schema = entity.schema ?? 'main';
  const exists = database.prepare(
    `SELECT 1 FROM ${quoteIdentifier(schema)}.sqlite_schema WHERE name = ? AND type IN ('table', 'view')`
  );
  try {
    if (!exists.get(entity.name)) throw new Error('SQL entity no longer exists');
  } finally {
    closeStatement(exists);
  }
  const statement = database.prepare(
    'SELECT name, type, "notnull" AS required, pk, dflt_value FROM pragma_table_xinfo(?, ?) WHERE hidden != 1'
  );
  try {
    return (
      statement.all(entity.name, schema) as {
        name: string;
        type: string;
        required: number;
        pk: number;
        dflt_value: string | null;
      }[]
    ).map((column) => ({
      name: column.name,
      databaseType: column.type || undefined,
      nullable: !column.required,
      primaryKey: Boolean(column.pk),
      defaultExpression: column.dflt_value ?? undefined,
    }));
  } finally {
    closeStatement(statement);
  }
}

function query(sql: string, params?: SqlParams): SqlResult {
  const statement = database.prepare(sql);
  try {
    // prepare() otherwise silently ignores statements following the first one.
    const tail = sql.slice(statement.sourceSQL.length);
    if (!/^(?:\s|;|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*$/.test(tail)) {
      throw new Error('Only one SQL statement is supported per query');
    }
    statement.setReadBigInts(true);
    statement.setReturnArrays(true);
    const args = Array.isArray(params)
      ? params.map(bindValue)
      : params === undefined
        ? []
        : [Object.fromEntries(Object.entries(params).map(([key, value]) => [key, bindValue(value)]))];
    const before = metadata.get() as {total: bigint; rowid: bigint};
    const sourceColumns = statement.columns();
    let result: SqlResult;
    if (sourceColumns.length) {
      const columns = sqlColumns(
        sourceColumns,
        (column) => column.name,
        (column) => column.type ?? undefined
      );
      const rows = statement.all(...(args as SQLInputValue[])) as unknown as unknown[][];
      for (const row of rows) {
        for (let i = 0; i < row.length; ++i) {
          if (typeof row[i] === 'bigint') row[i] = transportInteger(row[i] as bigint);
        }
      }
      result = {table: {columns, rows}};
    } else {
      statement.run(...(args as SQLInputValue[]));
      result = {affectedRows: 0};
    }
    const after = metadata.get() as {total: bigint; rowid: bigint; changes: bigint};
    if (after.total !== before.total) {
      result.affectedRows = Number(after.changes);
      if (after.rowid !== before.rowid) result.insertId = transportInteger(after.rowid);
    }
    return result;
  } finally {
    closeStatement(statement);
  }
}

function transaction(statements: readonly SqlStatement[]): SqlResult {
  validateSqlTransaction(statements);
  database.exec('BEGIN');
  try {
    let result: SqlResult;
    for (const {sql, params} of statements) result = query(sql, params);
    database.exec('COMMIT');
    return result;
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
}

parentPort.on('message', (request: SqliteRequest & {id: number}) => {
  try {
    let result: SqlResult | SqlEntity[] | SqlEntityColumn[];
    switch (request.type) {
      case 'open': {
        const {filePath, readOnly = false, busyTimeout = 5000, foreignKeys = true} = request.options;
        if (typeof filePath !== 'string' || !filePath) throw new Error('SQLite file path is required');
        if (!Number.isSafeInteger(busyTimeout) || busyTimeout < 0) throw new Error('Invalid SQLite busy timeout');
        database = new DatabaseSync(filePath, {
          readOnly,
          timeout: busyTimeout,
          enableForeignKeyConstraints: foreignKeys,
        });
        metadata = database.prepare(
          'SELECT total_changes() AS total, last_insert_rowid() AS rowid, changes() AS changes'
        );
        metadata.setReadBigInts(true);
        break;
      }
      case 'query':
        result = query(request.sql, request.params);
        break;
      case 'transaction':
        result = transaction(request.statements);
        break;
      case 'listEntities':
        result = listEntities();
        break;
      case 'getColumns':
        result = getColumns(request.entity);
        break;
      case 'close':
        closeStatement(metadata);
        database.close();
        break;
    }
    parentPort.postMessage({id: request.id, result});
    if (request.type === 'close') parentPort.close();
  } catch (error) {
    parentPort.postMessage({id: request.id, error: {message: error.message, code: error.code}});
  }
});
