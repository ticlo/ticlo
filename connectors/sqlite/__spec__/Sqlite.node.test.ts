import {mkdir, mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {
  ErrorEvent,
  Flow,
  Root,
  MemoryFlowStorage,
  encode,
  globalFunctions,
  makeLocalConnection,
  shouldHappen,
} from '@ticlo/core';
import type {Block, SqlClient, SqlResult} from '@ticlo/core';
import {NodeStorage} from '@ticlo/node/storage/NodeStorage.ts';
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
  it('lists tables and views across attached schemas and returns columns without interpolating entity names', async () => {
    const client = await open();
    await client.query(
      'CREATE TABLE "a.b" (id INTEGER PRIMARY KEY, name TEXT NOT NULL DEFAULT \'sample\', size INT GENERATED ALWAYS AS (length(name)) VIRTUAL)'
    );
    await client.query('CREATE VIEW names AS SELECT name FROM "a.b"');
    await client.query('ATTACH DATABASE \':memory:\' AS "extra.schema"');
    await client.query('CREATE TABLE "extra.schema"."quote""table" (value BLOB)');
    await client.query('CREATE TEMP TABLE temporary (value INT)');
    const entities = await client.listEntities();
    expect(entities).toEqual(
      expect.arrayContaining([
        {schema: 'main', name: 'a.b', kind: 'table'},
        {schema: 'main', name: 'names', kind: 'view'},
        {schema: 'extra.schema', name: 'quote"table', kind: 'table'},
        {schema: 'temp', name: 'temporary', kind: 'table'},
      ])
    );
    expect(await client.getColumns({schema: 'main', name: 'a.b'})).toEqual([
      {name: 'id', databaseType: 'INTEGER', nullable: true, primaryKey: true},
      {name: 'name', databaseType: 'TEXT', nullable: false, primaryKey: false, defaultExpression: "'sample'"},
      {name: 'size', databaseType: 'INT', nullable: true, primaryKey: false},
    ]);
    expect(await client.getColumns({schema: 'extra.schema', name: 'quote"table'})).toMatchObject([
      {name: 'value', databaseType: 'BLOB'},
    ]);
    expect(await client.getColumns({name: 'names'})).toMatchObject([{name: 'name'}]);
    await expect(client.getColumns({name: "a.b' OR 1=1 --"})).rejects.toThrow('no longer exists');
    await client.close();
    await expect(client.listEntities()).rejects.toThrow('closed');
    await expect(client.getColumns({name: 'names'})).rejects.toThrow('closed');
  });

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

  it('keeps a transaction together on the worker and rolls back failed statements', async () => {
    const client = await open();
    await client.query('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    const insert = 'INSERT INTO items VALUES (?)';
    const transaction = client.transaction([
      {sql: insert, params: [1]},
      {sql: insert, params: [2]},
    ]);
    const pending = client.query('SELECT id FROM items ORDER BY id');
    expect(await transaction).toMatchObject({affectedRows: 1, insertId: 2});
    expect((await pending).table.rows).toEqual([[1], [2]]);
    await expect(
      client.transaction([
        {sql: insert, params: [3]},
        {sql: insert, params: [1]},
      ])
    ).rejects.toThrow('UNIQUE');
    expect((await client.query('SELECT id FROM items ORDER BY id')).table.rows).toEqual([[1], [2]]);
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

  it('enforces readonly commands on the worker and restores its prior mode after errors', async () => {
    const root = new Root();
    const flow = root.addFlow('Main', {database: {'#is': 'database:sqlite', 'filePath': ':memory:'}});
    const path = 'Main.database';
    const [, reader] = makeLocalConnection(root, false, {readonly: true});
    const [, writer] = makeLocalConnection(root, false);
    try {
      root.runAll();
      const service = (await shouldHappen(() => flow.queryValue('database.#output'), 3000)) as SqlClient;
      await writer.executeCommand(path, 'query', {sql: 'CREATE TABLE items (value INTEGER)'});
      for (const sql of ['PRAGMA query_only = OFF', "ATTACH DATABASE ':memory:' AS extra", 'BEGIN']) {
        await expect(reader.executeCommand(path, 'query', {sql})).rejects.toThrow('not authorized');
      }
      const deniedWrite = reader.executeCommand(path, 'query', {sql: 'INSERT INTO items VALUES (1)'});
      await expect(deniedWrite).rejects.toThrow(/readonly/i);
      await writer.executeCommand(path, 'query', {sql: 'INSERT INTO items VALUES (?)', params: [2]});
      const response = await reader.executeCommand(path, 'query', {
        sql: 'SELECT * FROM items WHERE value = ?',
        params: [2],
      });
      expect(response.result.table.rows).toEqual([[2]]);
      expect((await service.query('PRAGMA query_only')).table.rows).toEqual([[0]]);
      await service.query('PRAGMA query_only = ON');
      await reader.executeCommand(path, 'query', {sql: 'SELECT 1'});
      expect((await service.query('PRAGMA query_only')).table.rows).toEqual([[1]]);
    } finally {
      reader.destroy();
      writer.destroy();
      root.destroy();
    }
  });

  it('runs a real sql:query block with a tagged, nonserializable client service', async () => {
    const flow = new Flow();
    let service: SqlClient;
    try {
      const block = flow.createBlock('database');
      block._load({'#is': 'database:sqlite', 'filePath': ':memory:'});
      Root.run();
      service = await shouldHappen(() => block.getValue('#output'), 3000);
      expect(globalFunctions.getDesc('database:sqlite').tags).toEqual(['sql-client', 'context-service']);
      expect(encode(service)).toContain('database:sqlite');
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
      {'^sqlite': {'#is': 'database:sqlite', 'filePath': relative(process.cwd(), filePath)}},
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

  it('resolves project file-path inputs through FlowStorage and blocks disallowed paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ticlo-sqlite-storage-'));
    directories.push(directory);
    await mkdir(join(directory, 'proj1'), {recursive: true});

    const desc = globalFunctions.getDesc('database:sqlite');
    expect(desc.properties?.find((prop) => prop.name === 'filePath')?.type).toBe('file-path');

    const root = new Root();
    const storage = new NodeStorage(directory);

    try {
      await root.setStorage(storage);
      await root.start();
      const flow = root.addFlow(
        '+proj1.main',
        {db: {'#is': 'database:sqlite', 'filePath': '+/app.sqlite'}},
        undefined,
        true
      );
      const block = flow.getValue('db') as Block;
      const service = (await shouldHappen(() => block.getValue('#output'), 3000)) as SqlClient;
      expect((await stat(join(directory, 'proj1', 'app.sqlite'))).isFile()).toBe(true);
      await service.query('CREATE TABLE t (v INTEGER)');
      await service.query('INSERT INTO t VALUES (7)');
      expect((await service.query('SELECT v FROM t')).table.rows).toEqual([[7]]);

      block.getProperty('#emit', true);
      block.setValue('filePath', 'https://example.com/remote.sqlite');
      await shouldHappen(() => block.getValue('#emit') instanceof ErrorEvent, 3000);
      expect(block.getValue('#output')).toBeUndefined();

      block.setValue('filePath', ':memory:');
      const memoryService = (await shouldHappen(() => block.getValue('#output'), 3000)) as SqlClient;
      expect((await memoryService.query('SELECT 1 AS ok')).table.rows).toEqual([[1]]);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });
});
