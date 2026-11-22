import {randomBytes, randomUUID} from 'node:crypto';
import {
  decode,
  encodeSorted,
  ErrorEvent,
  Flow,
  globalFunctions,
  Root,
  setSecretCipher,
  shouldHappen,
  type SqlClient,
} from '@ticlo/core';
import {SecretCipher} from '@ticlo/node';
import {MysqlClient} from '../index.ts';
import {localMysql84Url, localMysqlUrl} from './localMysql.ts';

const configuredUrl = process.env.TICLO_TEST_MYSQL_URL;
const useLocalPodman = !configuredUrl && process.env.GITHUB_ACTIONS !== 'true';
const schema = `ticlo_test_${randomUUID().replaceAll('-', '')}`;
const table = `\`${schema}\`.\`items\``;

it('registers mysql:client under the database category with full-name display', () => {
  expect(globalFunctions.getDesc('mysql:client')).toMatchObject({
    category: 'database',
    libraryId: 'mysql',
    useFullName: true,
    tags: ['sql-client', 'context-service'],
  });
});

it.each([null, ''])('rejects a URL password for Block authentication (%j)', async (password) => {
  await expect(MysqlClient.open({connectionString: 'mysql://root:example@localhost/test', password})).rejects.toThrow(
    'password in #secret'
  );
});

describe.skipIf(!configuredUrl && !useLocalPodman)('MySQL connector', () => {
  let client: MysqlClient;
  let connectionString = configuredUrl;

  beforeAll(
    async () => {
      if (useLocalPodman) connectionString = await localMysqlUrl();
      client = await MysqlClient.open({connectionString, maxConnections: 1});
      await client.query(`CREATE DATABASE \`${schema}\``);
      await client.query(
        `CREATE TABLE ${table} (id BIGINT PRIMARY KEY AUTO_INCREMENT, label VARCHAR(100) NOT NULL DEFAULT 'test') ENGINE=InnoDB`
      );
      await client.query(`CREATE VIEW \`${schema}\`.\`item_ids\` AS SELECT id FROM ${table}`);
    },
    useLocalPodman ? 130_000 : undefined
  );

  afterAll(async () => {
    if (!client) return;
    try {
      await client.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    } finally {
      await client.close();
    }
  });

  it('protects readonly queries and returns the pooled connection to writable use', async () => {
    expect((await client.queryReadonly('SELECT ? AS value', [42])).table.rows).toEqual([[42]]);
    await expect(client.queryReadonly(`INSERT INTO ${table} (id) VALUES (105)`)).rejects.toThrow(/read.?only/i);
    await expect(client.queryReadonly("SELECT 1 INTO OUTFILE '/tmp/ticlo.sql'")).rejects.toThrow(/readonly/i);
    await expect(client.queryReadonly('SET TRANSACTION READ WRITE')).rejects.toThrow(/read.?only/i);
    await expect(
      client.queryReadonly(`WITH v AS (SELECT 1) SELECT * FROM v; INSERT INTO ${table} (id) VALUES (105)`)
    ).rejects.toThrow();
    expect((await client.query(`SELECT id FROM ${table} WHERE id = 105`)).table.rows).toEqual([]);
    await client.query(`INSERT INTO ${table} (id) VALUES (105)`);
    expect((await client.queryReadonly(`SELECT id FROM ${table} WHERE id = 105`)).table.rows).toEqual([['105']]);
  });

  it('preserves precision, binary parameters, duplicate columns, and empty results', async () => {
    const binary = new Uint8Array([0, 255, 8]);
    const {table: result} = await client.query(
      'SELECT CAST(? AS SIGNED) AS v, CAST(? AS DECIMAL(35,19)) AS v, CAST(? AS BINARY(3)) AS v_2, CAST(? AS DATETIME(6)) AS time',
      ['9223372036854775807', '0.1234567890123456789', binary, '2026-11-11 12:00:00.123456']
    );
    expect(result.columns.map(({name}) => name)).toEqual(['v', 'v_3', 'v_2', 'time']);
    expect(result.columns.map(({sourceName}) => sourceName)).toEqual(['v', 'v', 'v_2', 'time']);
    expect(result.rows).toEqual([
      ['9223372036854775807', '0.1234567890123456789', binary, '2026-11-11 12:00:00.123456'],
    ]);
    expect(result.rows[0][2].constructor).toBe(Uint8Array);
    const empty = await client.query(`SELECT id FROM ${table} WHERE 1 = 0`);
    expect(empty.table.rows).toEqual([]);
    expect(empty.table.columns).toMatchObject([{name: 'id'}]);
    expect(empty.affectedRows).toBeUndefined();
    await expect(client.query('SELECT ?', {value: 1})).rejects.toThrow('must be an array');
  });

  it('lists tables and views and returns column metadata', async () => {
    const entities = (await client.listEntities()).filter((entity) => entity.schema === schema);
    const items = {catalog: 'def', schema, name: 'items', kind: 'table'};
    expect(entities).toHaveLength(2);
    expect(entities).toContainEqual({catalog: 'def', schema, name: 'item_ids', kind: 'view'});
    expect(entities).toContainEqual(items);
    expect(await client.getColumns(items)).toMatchObject([
      {name: 'id', databaseType: expect.stringMatching(/^bigint/), nullable: false, primaryKey: true},
      {name: 'label', databaseType: 'varchar(100)', nullable: false, primaryKey: false},
    ]);
    await expect(client.getColumns({...items, name: "missing' OR true -- "})).rejects.toThrow('unavailable');
  });

  it('reports write metadata and rolls back failed transactions', async () => {
    const {affectedRows, insertId} = await client.query(`INSERT INTO ${table} (label) VALUES (?)`, ["O'Reilly"]);
    expect(affectedRows).toBe(1);
    const result = await client.query(`SELECT label FROM ${table} WHERE id = ?`, [insertId]);
    expect(result.table.rows).toEqual([["O'Reilly"]]);

    const insert = `INSERT INTO ${table} (id) VALUES (?)`;
    await expect(client.query(`${insert}; SELECT 1`, [101])).rejects.toThrow();
    await expect(client.transaction([{sql: insert, params: [102]}, {sql: `DROP TABLE ${table}`}])).rejects.toThrow(
      'statement 2'
    );
    await expect(
      client.transaction([
        {sql: insert, params: [103]},
        {sql: insert, params: [103]},
      ])
    ).rejects.toMatchObject({code: 'ER_DUP_ENTRY'});
    expect((await client.query(`SELECT id FROM ${table} WHERE id BETWEEN 101 AND 103`)).table.rows).toEqual([]);
    expect(await client.transaction([{sql: insert, params: [104]}])).toMatchObject({affectedRows: 1});
  });

  it('clears session state before reusing a pooled connection', async () => {
    await client.query('SET @ticlo_test = 1');
    expect((await client.query('SELECT @ticlo_test AS value')).table.rows).toEqual([[null]]);
  });

  it('publishes a SQL service using the encrypted block password', async () => {
    const url = new URL(connectionString);
    const password = decodeURIComponent(url.password);
    url.password = '';
    setSecretCipher(new SecretCipher(randomBytes(32)));
    const flow = new Flow();
    try {
      const block = flow.createBlock('database');
      block._load({'#is': 'mysql:client', 'connectionString': url.toString(), '~auth': {'#is': 'auth:password'}});
      block.setValue('#secret', password);
      Root.run();
      const service: SqlClient = await shouldHappen(
        () => block.getValue('#output'),
        5000,
        'MySQL block did not connect'
      );
      expect((await service.query('SELECT 1 AS value')).table.rows).toEqual([[1]]);
      const saved = decode(encodeSorted(block._save()));
      expect(saved['#secret']).toBeInstanceOf(Uint8Array);
      expect(block.getValue('#secret')).toBeUndefined();
      const restored = flow.createBlock('restored');
      restored._load(saved);
      Root.run();
      await shouldHappen(() => restored.getValue('#output'), 5000, 'Restored MySQL block did not connect');
    } finally {
      flow.destroy();
      setSecretCipher(undefined);
    }
  }, 15_000);
});

const mysql84Url = process.env.TICLO_TEST_MYSQL84_URL;

it('authenticates with MySQL 8.4 caching_sha2_password only when auth is configured', async () => {
  const url = new URL(mysql84Url ?? (await localMysql84Url()));
  const password = decodeURIComponent(url.password);
  url.password = '';
  const flow = new Flow();
  try {
    const authenticated = flow.createBlock('authenticated');
    authenticated._load({
      '#is': 'mysql:client',
      'connectionString': url.toString(),
      '~auth': {'#is': 'auth:password'},
    });
    authenticated.setValue('#secret', password);
    const unauthenticated = flow.createBlock('unauthenticated');
    unauthenticated._load({'#is': 'mysql:client', 'connectionString': url.toString(), 'auth': null});
    unauthenticated.setValue('#secret', password);
    Root.run();
    const service: SqlClient = await shouldHappen(() => authenticated.getValue('#output'), 5000);
    const {table} = await service.query("SELECT plugin FROM mysql.user WHERE CONCAT(User, '@', Host) = CURRENT_USER()");
    expect(table.rows).toEqual([['caching_sha2_password']]);
    const {detail} = await shouldHappen(() => {
      const event = unauthenticated.getValue('#emit');
      return event instanceof ErrorEvent && event;
    }, 5000);
    expect(detail).toMatchObject({code: 'ER_ACCESS_DENIED_ERROR'});
    expect(unauthenticated.getValue('#output')).toBeUndefined();
  } finally {
    flow.destroy();
  }
}, 130_000);
