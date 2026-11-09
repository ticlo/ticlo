import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {ErrorEvent, Flow, Root, MemoryFlowStorage, encode, globalFunctions, shouldHappen} from '@ticlo/core';
import type {Block, SqlClient, SqlResult} from '@ticlo/core';
import {SqliteClient} from '../index.ts';
import {SqliteClientFunction} from '../ClientFunction.ts';
import {DataWrapper} from '@ticlo/core/block/FunctonData.ts';

const clients: SqliteClient[] = [];
const directories: string[] = [];

async function open(filePath = ':memory:', readOnly = false) {
  const client = await SqliteClient.open({filePath, readOnly});
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

describe('SQLite connector', () => {
  it('binds parameters, returns tables, and does not reuse stale write metadata', async () => {
    const client = await open();
    await client.query('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, enabled INTEGER)');
    expect(await client.query('INSERT INTO items (name, enabled) VALUES (?, ?)', ["O'Reilly", true])).toEqual({
      affectedRows: 1,
      insertId: 1,
    });
    const result = await client.query('SELECT id, name, enabled FROM items WHERE id = $id', {id: 1});
    expect(result.table.rows).toEqual([[1, "O'Reilly", 1]]);
    expect(result.table.columns.map((column) => column.name)).toEqual(['id', 'name', 'enabled']);
    expect(result.affectedRows).toBeUndefined();
    expect(await client.query('CREATE TABLE other (id INTEGER)')).toEqual({affectedRows: 0});
    expect(await client.query('UPDATE items SET name = ? WHERE id = ?', ['changed', 2])).toEqual({affectedRows: 0});
    const empty = await client.query('SELECT id FROM items WHERE id = ?', [2]);
    expect(empty.table.rows).toEqual([]);
    expect(empty.table.columns[0].name).toBe('id');
    const returning = await client.query('INSERT INTO items (name) VALUES (?) RETURNING id, name', ['second']);
    expect(returning.table.rows).toEqual([[2, 'second']]);
    expect(returning.affectedRows).toBe(1);
    expect(returning.insertId).toBe(2);
  });

  it('preserves large integers, binary values, and duplicate columns', async () => {
    const client = await open();
    const value = new Uint8Array([0, 255, 8]);
    const {table} = await client.query('SELECT ? AS value, ? AS value, 3 AS value_2', [9223372036854775807n, value]);
    expect(table.columns.map((column) => column.name)).toEqual(['value', 'value_3', 'value_2']);
    expect(table.columns.map((column) => column.sourceName)).toEqual(['value', 'value', 'value_2']);
    expect(table.rows).toEqual([['9223372036854775807', value, 3]]);
    expect(() => encode(table)).not.toThrow();
  });

  it('rejects multiple statements before executing writes and survives SQL errors', async () => {
    const client = await open();
    await client.query('CREATE TABLE items (id INTEGER)');
    await expect(client.query('INSERT INTO items VALUES (1); INSERT INTO items VALUES (2)')).rejects.toThrow(
      'one SQL statement'
    );
    expect((await client.query('SELECT * FROM items')).table.rows).toEqual([]);
    await expect(client.query('not valid sql')).rejects.toThrow();
    expect((await client.query("SELECT ';' AS value; /* trailing comment */ -- end")).table.rows).toEqual([[';']]);
  });

  it('serializes submitted requests, drains them on close, and rejects later queries', async () => {
    const client = await open();
    await client.query('CREATE TABLE items (id INTEGER)');
    const requests = [
      client.query('INSERT INTO items VALUES (?)', [1]),
      client.query('INSERT INTO items VALUES (?)', [2]),
      client.query('SELECT * FROM items ORDER BY id'),
    ];
    const closing = client.close();
    await expect(client.query('SELECT 3')).rejects.toThrow('closed');
    expect((await Promise.all(requests))[2].table.rows).toEqual([[1], [2]]);
    await closing;
    expect(client.close()).toBe(closing);
  });

  it('supports read-only files and foreign key enforcement', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ticlo-sqlite-'));
    directories.push(directory);
    const filePath = join(directory, 'test.sqlite');
    const writer = await open(filePath);
    await writer.query('CREATE TABLE parents (id INTEGER PRIMARY KEY)');
    await writer.query('CREATE TABLE children (parent INTEGER REFERENCES parents(id))');
    await expect(writer.query('INSERT INTO children VALUES (42)')).rejects.toThrow('FOREIGN KEY');
    await writer.query('INSERT INTO parents VALUES (1)');
    await writer.close();
    const reader = await open(filePath, true);
    expect((await reader.query('SELECT id FROM parents')).table.rows).toEqual([[1]]);
    await expect(reader.query('DELETE FROM parents')).rejects.toThrow(/readonly/);
    await expect(SqliteClient.open({filePath: join(directory, 'missing.sqlite'), readOnly: true})).rejects.toThrow();
    await expect(SqliteClient.open({filePath, busyTimeout: -1})).rejects.toThrow('busy timeout');
  });

  it('runs a real sql:query block with a tagged, nonserializable client service', async () => {
    const flow = new Flow();
    let service: SqlClient;
    try {
      const block = flow.createBlock('database');
      block._load({'#is': 'sqlite:client', 'filePath': ':memory:'});
      Root.run();
      service = await shouldHappen(() => block.getValue('#output'), 3000);
      expect(globalFunctions.getDesc('sqlite:client').tags).toContain('sql-client');
      expect(encode(service)).toContain('sqlite:client');
      await service.query('CREATE TABLE items (name TEXT)');
      const query = flow.createBlock('query');
      query._load({
        '#is': 'sql:query',
        '~client': '##.database.#output',
        'sql': 'INSERT INTO items VALUES (?) RETURNING name',
        'params': ['test'],
      });
      Root.run();
      expect(query.getValue('client')).toBe(service);
      query.updateValue('#call', {});
      Root.run();
      const table = (await shouldHappen(() => query.getValue('#output'), 3000)) as SqlResult['table'];
      expect(table.rows).toEqual([['test']]);

      const oldService = service;
      block.setValue('busyTimeout', 200);
      Root.run();
      service = await shouldHappen(() => block.getValue('#output'), 3000);
      expect(service).not.toBe(oldService);
      await expect(oldService.query('SELECT 1')).rejects.toThrow('closed');
      // Reopening an in-memory connection gives a new database, not the old handle.
      await expect(service.query('SELECT * FROM items')).rejects.toThrow('no such table');

      block.setValue('filePath', '');
      Root.run();
      expect(block.getValue('#output')).toBeUndefined();
      await expect(service.query('SELECT 1')).rejects.toThrow('closed');
    } finally {
      flow.destroy();
    }
    await expect(service.query('SELECT 1')).rejects.toThrow();
  });

  it('creates a relative-path database from a stored global client only after startup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ticlo-sqlite-global-'));
    directories.push(directory);
    const filePath = join(directory, 'database');
    const root = new Root();
    const storage = new MemoryFlowStorage();
    storage.saveFlow(
      null,
      {'^sqlite': {'#is': 'sqlite:client', 'filePath': relative(process.cwd(), filePath)}},
      '#global'
    );
    let service: SqlClient;
    try {
      await root.setStorage(storage);
      await expect(stat(filePath)).rejects.toMatchObject({code: 'ENOENT'});
      await root.start();
      const block = root._globalRoot.getValue('^sqlite') as Block;
      service = await shouldHappen(() => block.getValue('#output'), 3000);
      expect((await stat(filePath)).isFile()).toBe(true);
      expect((await service.query('SELECT 42 AS value')).table.rows).toEqual([[42]]);

      block.getProperty('#emit', true);
      block.setValue('filePath', join(directory, 'missing', 'database'));
      await shouldHappen(() => block.getValue('#emit') instanceof ErrorEvent, 3000);
      expect(block.getValue('#output')).toBeUndefined();
      await expect(stat(join(directory, 'missing'))).rejects.toMatchObject({code: 'ENOENT'});
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
    await expect(service.query('SELECT 1')).rejects.toThrow('closed');
  });

  it('closes connections opened after their function was destroyed', async () => {
    const data = new DataWrapper({filePath: ':memory:'});
    const fn = new SqliteClientFunction(data);
    const opening = fn.run();
    fn.destroy();
    await opening;
    expect(data.outputs['undefined']).toBeUndefined();
  });
});
