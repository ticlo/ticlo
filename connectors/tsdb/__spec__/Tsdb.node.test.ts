import {mkdir, mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  DateTime,
  Flow,
  MemoryFlowStorage,
  Root,
  encode,
  globalFunctions,
  makeLocalConnection,
  shouldHappen,
  waitTick,
  type Block,
  type HistoryClient,
  type HistoryQueryResult,
} from '@ticlo/core';
import {NodeStorage} from '@ticlo/node/storage/NodeStorage.ts';
import {TsdbClient} from '../index.ts';

const clients: TsdbClient[] = [];
const directories: string[] = [];

async function openMemory(timezone = 'UTC') {
  const client = await TsdbClient.open({filePath: ':memory:', timezone, flushIntervalMs: 0});
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await waitTick(30);
  await Promise.all(directories.splice(0).map((dir) => rm(dir, {recursive: true, force: true, maxRetries: 5})));
});

describe('TSDB history connector', () => {
  it('resolves filePath via NodeStorage like sqlite:client and rejects disallowed paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ticlo-tsdb-storage-'));
    directories.push(dir);
    await mkdir(join(dir, 'proj1'), {recursive: true});

    const root = new Root();
    await root.setStorage(new NodeStorage(dir));
    await root.start();
    const flow = root.addFlow('+proj1.main', undefined, undefined, true);

    try {
      const clientBlock = flow.createBlock('tsdb');
      clientBlock._load({'#is': 'tsdb:client', 'filePath': '+/hist-data', 'timezone': 'UTC'});
      root.runAll();

      const service = (await shouldHappen(() => clientBlock.getValue('#output'), 3000)) as HistoryClient;
      expect(globalFunctions.getDesc('tsdb:client')).toMatchObject({
        category: 'database',
        libraryId: 'tsdb',
        useFullName: true,
        tags: ['history-client', 'context-service'],
      });
      expect(encode(service)).toContain('tsdb:client');

      const ts0 = Date.UTC(2026, 0, 1, 0, 0, 0);
      await service.record('proj.power', ts0, 42);
      const catalogStat = await stat(join(dir, 'proj1/hist-data/catalog.json'));
      expect(catalogStat.isFile()).toBe(true);

      // Disallowed external/URL paths produce an error output and leave #output undefined.
      clientBlock.setValue('filePath', 'https://example.com/hist');
      root.runAll();
      await shouldHappen(() => clientBlock.getValue('#output') === undefined, 2000);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('records and queries numeric, boolean, and jsonesc value histories with rollup & search', async () => {
    const client = await openMemory('UTC');
    const t0 = Date.UTC(2026, 3, 1, 0, 0, 0);

    await client.record('plant.boiler.temp', t0, 100);
    await client.record('plant.boiler.temp', t0 + 1_800_000, 150);
    await client.record('plant.boiler.temp', t0 + 3_600_000, 200);

    await client.record('plant.boiler.active', t0, true);
    await client.record('plant.boiler.active', t0 + 1_800_000, false);

    const tsObj = DateTime.fromMillis(t0 + 500, {zone: 'utc'});
    await client.record('plant.events', t0, '\braw:escaped-string');
    await client.record('plant.events', t0 + 100, {at: tsObj, count: 9n});

    const all = client.listSeries();
    expect(all.map((s) => [s.id, s.kind])).toEqual([
      ['plant.boiler.active', 'boolean'],
      ['plant.boiler.temp', 'number'],
      ['plant.events', 'value'],
    ]);

    const filtered = client.listSeries('BOILER');
    expect(filtered.map((s) => s.id)).toEqual(['plant.boiler.active', 'plant.boiler.temp']);

    const hourlyMax = await client.query({
      id: 'plant.boiler.temp',
      start: t0,
      end: t0 + 7_199_999,
      interval: '1h',
      rollup: 'max',
    });
    expect(hourlyMax.kind).toBe('number');
    expect(hourlyMax.interval).toBe('1h');
    expect(hourlyMax.table.rows.map((r) => r[1])).toEqual([150, 200]);
    expect(DateTime.isDateTime(hourlyMax.table.rows[0][0])).toBe(true);

    const boolAnd = await client.query({
      id: 'plant.boiler.active',
      start: t0,
      end: t0 + 3_599_999,
      interval: '1h',
      rollup: 'and',
    });
    expect(boolAnd.table.rows[0][1]).toBe(false);

    const boolCount = await client.query({
      id: 'plant.boiler.active',
      start: t0,
      end: t0 + 3_599_999,
      interval: '1h',
      rollup: 'count',
    });
    expect(boolCount.table.rows[0][1]).toBe(2);

    const rawVals = await client.query({
      id: 'plant.events',
      start: t0,
      end: t0 + 1000,
    });
    expect(rawVals.kind).toBe('value');
    expect(rawVals.table.rows).toHaveLength(2);
    expect(rawVals.table.rows[0][1]).toBe('\braw:escaped-string');
    expect((rawVals.table.rows[1][1] as {count: bigint; at: DateTime}).count).toBe(9n);
    expect((rawVals.table.rows[1][1] as {at: DateTime}).at.toMillis()).toBe(t0 + 500);
  });

  it('works end-to-end with history blocks, default binding/parent id, and LocalConnection commands', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ticlo-tsdb-e2e-'));
    directories.push(dir);
    const root = new Root();
    await root.setStorage(new MemoryFlowStorage());
    await root.start();

    const flow = root.addFlow('Factory', {
      tsdb: {'#is': 'tsdb:client', 'filePath': dir, 'timezone': 'UTC'},
      line1: {
        '#is': 'group',
        'sensor': {
          '#is': 'add',
          '0': 20,
          '1': 5,
          '#-history': {
            '#is': 'history',
            '#mode': 'onCall',
            '~#call': '##.#emit',
            '~service': '#flow.tsdb.#output',
            'time': 1_700_000_000_000,
          },
        },
      },
      standaloneMeter: {
        '#is': 'add',
        '0': 10,
        '1': 3,
      },
      recordMeter: {
        '#is': 'history',
        '~service': '#flow.tsdb.#output',
        '~value': '#flow.standaloneMeter.#output',
        'time': 1_700_000_002_000,
      },
    });
    const [, conn] = makeLocalConnection(root, false);

    try {
      root.runAll();
      const service = (await shouldHappen(() => flow.queryValue('tsdb.#output'), 3000)) as HistoryClient;

      // Trigger sensor update now that tsdb service is connected.
      (flow.queryValue('line1.sensor') as Block).setValue('1', 7);
      root.runAll();

      await shouldHappen(() => {
        const listed = service.listSeries();
        return Array.isArray(listed) && listed.length === 2;
      }, 3000);

      const listed = await conn.executeCommand('Factory.tsdb', 'listSeries');
      expect((listed.result as {series: Array<{id: string}>}).series.map((s) => s.id)).toEqual([
        'Factory.line1.sensor',
        'Factory.standaloneMeter',
      ]);

      const queryRes = (
        await conn.executeCommand('Factory.tsdb', 'query', {
          id: 'Factory.line1.sensor',
          start: 1_700_000_000_000 - 1000,
          end: 1_700_000_000_000 + 1000,
          interval: 'raw',
        })
      ).result as HistoryQueryResult;
      expect(queryRes.table.rows).toHaveLength(1);
      expect(queryRes.table.rows[0][1]).toBe(27);

      const boundRes = (
        await conn.executeCommand('Factory.tsdb', 'query', {
          id: 'Factory.standaloneMeter',
          start: 1_700_000_000_000,
          end: 1_700_000_005_000,
          interval: 'raw',
        })
      ).result as HistoryQueryResult;
      expect(boundRes.table.rows).toHaveLength(1);
      expect(boundRes.table.rows[0][1]).toBe(13);
    } finally {
      conn.destroy();
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('reopens persisted TSDB folder from stored global service config after start()', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ticlo-tsdb-global-'));
    directories.push(dir);
    const root = new Root();
    const storage = new MemoryFlowStorage();
    storage.saveFlow(null, {'^tsdb': {'#is': 'tsdb:client', 'filePath': dir, 'timezone': 'UTC'}}, '#global');

    try {
      await root.setStorage(storage);
      await root.start();
      const service = (await shouldHappen(() => root._globalRoot.queryValue('^tsdb.#output'), 3000)) as HistoryClient;
      await service.record('global.metric', Date.UTC(2026, 0, 1, 0, 0, 0), 77);
      expect(service.listSeries()).toEqual([expect.objectContaining({id: 'global.metric', kind: 'number'})]);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });
});
