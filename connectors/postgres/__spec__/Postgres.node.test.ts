import {randomBytes, randomUUID} from 'node:crypto';
import {
  decode,
  encode,
  encodeSorted,
  Flow,
  Root,
  setSecretCipher,
  shouldHappen,
  type SqlClient,
  type SqlTable,
} from '@ticlo/core';
import {SecretCipher} from '@ticlo/node';
import {parseIntoClientConfig} from 'pg-connection-string';
import {PostgresClient} from '../index.ts';

const connectionEnv = 'TICLO_TEST_POSTGRES_URL';
const connectionString = process.env[connectionEnv];
const schema = `ticlo.${randomUUID()}`;
const tableName = 'quote"table';
const table = `"${schema}"."quote""table"`;

it('rejects passwords in the public URL for a split connection', async () => {
  for (const connectionString of [
    'postgresql://user:example@localhost/test',
    'postgresql://user@localhost/test?password=example',
  ]) {
    await expect(PostgresClient.open({connectionString, password: ''})).rejects.toThrow('password in #secret');
  }
});

describe.skipIf(!connectionString)('PostgreSQL connector', () => {
  let client: PostgresClient;

  beforeAll(async () => {
    client = await PostgresClient.open({connectionString, maxConnections: 1});
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, label text NOT NULL DEFAULT 'test')`);
    await client.query(`CREATE VIEW "${schema}".items AS SELECT id FROM ${table}`);
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await client.close();
    }
  });

  it('binds values and preserves exact numbers, timestamps, binary data and duplicate column names', async () => {
    const binary = new Uint8Array([0, 255, 8]);
    const {table: result} = await client.query(
      `SELECT $1::bigint AS v, $2::numeric AS v, $3::bytea AS v_2, $4::timestamp AS time`,
      ['9223372036854775807', '0.1234567890123456789', binary, '2026-11-11 12:00:00.123456']
    );
    expect(result.columns.map((column) => column.name)).toEqual(['v', 'v_3', 'v_2', 'time']);
    expect(result.columns.map((column) => column.sourceName)).toEqual(['v', 'v', 'v_2', 'time']);
    expect(result.rows).toEqual([
      ['9223372036854775807', '0.1234567890123456789', binary, '2026-11-11 12:00:00.123456'],
    ]);
    expect(() => encode(result)).not.toThrow();
    await expect(client.query('SELECT $1::text', {id: 'value'})).rejects.toThrow('must be an array');
  });

  it('reports empty results and discovers schema-qualified tables, views and columns', async () => {
    const entities = (await client.listEntities()).filter((entity) => entity.schema === schema);
    expect(entities).toEqual([
      {catalog: expect.any(String), schema, name: 'items', kind: 'view'},
      {catalog: expect.any(String), schema, name: tableName, kind: 'table'},
    ]);
    expect(await client.getColumns(entities[1])).toMatchObject([
      {name: 'id', databaseType: 'integer', primaryKey: true, nullable: false},
      {name: 'label', databaseType: 'text', primaryKey: false, nullable: false, defaultExpression: "'test'::text"},
    ]);
    await expect(client.getColumns({...entities[1], name: "missing' OR true --"})).rejects.toThrow('unavailable');
    const result = await client.query(`SELECT id FROM ${table} WHERE FALSE`);
    expect(result.table.rows).toEqual([]);
    expect(result.table.columns).toMatchObject([{name: 'id'}]);
    expect(result.affectedRows).toBeUndefined();
  });

  it('rejects batches before writes and rolls back a transaction on error', async () => {
    const insert = `INSERT INTO ${table} (id) VALUES ($1)`;
    await expect(client.query(`INSERT INTO ${table} (id) VALUES (101); SELECT 1`)).rejects.toThrow();
    await expect(client.transaction([{sql: insert, params: [102]}, {sql: 'COMMIT'}])).rejects.toThrow('statement 2');
    await expect(
      client.transaction([
        {sql: insert, params: [103]},
        {sql: insert, params: [103]},
      ])
    ).rejects.toMatchObject({
      code: '23505',
    });
    await expect(client.query('BEGIN')).rejects.toThrow('sql:transaction');
    expect((await client.query(`SELECT id FROM ${table} WHERE id BETWEEN 101 AND 103`)).table.rows).toEqual([]);
  });

  it('connects with a separate secret, restores it from storage and publishes a service for Flow transactions', async () => {
    const password = parseIntoClientConfig(connectionString).password as string;
    const passwordEnv = 'TICLO_TEST_POSTGRES_PASSWORD';
    const url = new URL(connectionString);
    url.password = '';
    url.searchParams.delete('password');
    vi.stubEnv(passwordEnv, password);
    setSecretCipher(new SecretCipher(randomBytes(32)));
    const flow = new Flow();
    try {
      const block = flow.createBlock('database');
      block._load({
        '#is': 'postgres:client',
        'connectionString': url.toString(),
        '~#secret': {'#is': 'node:env', 'name': passwordEnv},
      });
      Root.run();
      const service: SqlClient = await shouldHappen(() => block.getValue('#output'), 5000);
      expect(encode(service)).toContain('postgres:client');
      expect(block.getValue('#secret')).toBeUndefined();
      expect(flow.save().database).not.toHaveProperty('#secret');

      if (password) {
        block.setValue('#secret', password);
        const saved = decode(encodeSorted(block._save())) as Record<string, unknown>;
        expect(saved['#secret']).toBeInstanceOf(Uint8Array);
        const restored = flow.createBlock('restored');
        restored._load(saved);
        Root.run();
        await shouldHappen(() => restored.getValue('#output'), 5000);
        expect(restored.getValue('#secret')).toBeUndefined();
      }
      const transaction = flow.createBlock('transaction');
      transaction._load({
        '#is': 'sql:transaction',
        '~client': '##.database.#output',
        'statements': [
          {sql: `INSERT INTO ${table} (id) VALUES ($1)`, params: [104]},
          {sql: `UPDATE ${table} SET label = $1 WHERE id = $2 RETURNING label`, params: ["O'Reilly", 104]},
        ],
      });
      Root.run();
      transaction.updateValue('#call', {});
      Root.run();
      const result: SqlTable = await shouldHappen(() => transaction.getValue('#output'), 5000);
      expect(result.rows).toEqual([["O'Reilly"]]);
      expect(transaction.getValue('affectedRows')).toBe(1);
      expect((await client.query(`SELECT label FROM ${table} WHERE id = 104`)).table.rows).toEqual([["O'Reilly"]]);
    } finally {
      flow.destroy();
      setSecretCipher(undefined);
      vi.unstubAllEnvs();
    }
  });
});
