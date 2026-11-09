import {parentPort} from 'node:worker_threads';
import {DatabaseSync, type SQLInputValue, type StatementSync} from 'node:sqlite';
import type {SqlColumn, SqlParams, SqlResult} from '@ticlo/core';
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
      const reserved = new Set(sourceColumns.map((column) => column.name));
      const used = new Set<string>();
      const columns: SqlColumn[] = sourceColumns.map((column, index) => {
        const base = column.name || `column${index + 1}`;
        let name = base;
        let suffix = 2;
        while (used.has(name)) {
          name = `${base}_${suffix++}`;
          while (reserved.has(name)) name = `${base}_${suffix++}`;
        }
        used.add(name);
        return {name, type: 'any', sourceName: column.name, databaseType: column.type ?? undefined};
      });
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

parentPort.on('message', (request: SqliteRequest & {id: number}) => {
  try {
    let result: SqlResult;
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
