import {
  Block,
  ErrorEvent,
  Flow,
  Root,
  escapedObject,
  globalFunctions,
  historyClientApi,
  historyClientCommands,
  makeLocalConnection,
  destroyLastLocalConnection,
  toDateTime,
  toHistoryEpochMs,
  updateGlobalSettings,
  type HistoryClient,
} from '../../../index.ts';
import {DataWrapper} from '../../../block/FunctonData.ts';
import {DateTime} from 'luxon';

describe('history function and historyClientApi', () => {
  it('registers history without a namespace', () => {
    const desc = globalFunctions.getDesc('history');
    expect(desc).toBeDefined();
    expect(desc.id).toBe('history');
    expect(desc.libraryId).toBeUndefined();
    expect(desc.tags).toContain('addon');
    expect(desc.properties.find((p) => p.name === 'service')).toMatchObject({
      type: 'service',
      options: ['history-client'],
      create: 'tsdb:client',
    });
    for (const propName of ['raw', 'rollup15s', 'rollup5m', 'rollup1h', 'rollup1d']) {
      expect(desc.properties.find((p) => p.name === propName)).toBeUndefined();
    }
  });

  it('defaults series id to value binding source block or parent block path, and uses explicit id when provided', () => {
    const root = new Root();
    const flow = root.addFlow('Main');
    const folder = flow.createBlock('room');
    const child = folder.createBlock('temp');
    const sensor = flow.createBlock('sensor');
    sensor._load({'#is': 'add', '0': 10, '1': 2});
    const boundHistory = flow.createBlock('boundHistory');
    const records: Array<{id: string; ts: number; value: unknown; options: unknown}> = [];
    const client = escapedObject<HistoryClient>('test:history', {
      timezone: 'UTC',
      record(id, ts, value, options) {
        records.push({id, ts, value, options});
      },
      listSeries: () => [],
      query: async () => ({
        table: {columns: [], rows: []},
        kind: 'number',
        truncated: false,
        timezone: 'UTC',
      }),
    });

    child._load({
      '#is': 'history',
      'service': client,
      'time': 1_700_000_000_000,
      'value': 21.5,
      'kind': 'number',
    });
    boundHistory._load({
      '#is': 'history',
      'service': client,
      'time': 1_700_000_001_000,
      '~value': '##.sensor.#output',
    });
    root.runAll();

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      id: 'Main.room',
      ts: 1_700_000_000_000,
      value: 21.5,
      options: {kind: 'number'},
    });
    expect(records[1]).toEqual({
      id: 'Main.sensor',
      ts: 1_700_000_001_000,
      value: 12,
      options: undefined,
    });

    child.setValue('id', 'custom.series');
    child.setValue('time', 1_700_000_005_000);
    child.setValue('value', 22.5);
    root.runAll();

    expect(records).toHaveLength(3);
    expect(records[2].id).toBe('custom.series');
    expect(records[2].value).toBe(22.5);

    // Blank id falls back to parent block path.
    child.setValue('id', '   ');
    child.setValue('time', 1_700_000_010_000);
    child.setValue('value', 23.0);
    root.runAll();
    expect(records[3].id).toBe('Main.room');

    root.destroy();
  });

  it('reads parent #output when attached as #-history addon without explicit value', () => {
    const root = new Root();
    const flow = root.addFlow('Calc');
    const records: Array<{id: string; ts: number; value: unknown}> = [];
    const client = escapedObject<HistoryClient>('test:history', {
      timezone: 'UTC',
      record(id, ts, value) {
        records.push({id, ts, value});
      },
      listSeries: () => [],
      query: async () => ({
        table: {columns: [], rows: []},
        kind: 'number',
        truncated: false,
        timezone: 'UTC',
      }),
    });

    flow.load({
      add: {
        '#is': 'add',
        '0': 10,
        '1': 5,
        '#-history': {
          '#is': 'history',
          '#mode': 'onCall',
          '~#call': '##.#emit',
          'service': client,
          'time': 1_700_000_000_000,
        },
      },
    });
    root.runAll();

    expect(records).toEqual([{id: 'Calc.add', ts: 1_700_000_000_000, value: 15}]);

    (flow.getValue('add') as Block).setValue('1', 25);
    root.runAll();

    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({id: 'Calc.add', value: 35});

    root.destroy();
  });

  it('throws on invalid timestamp and validates historyClientApi commands', async () => {
    const fnId = 'history-client-api-test';
    globalFunctions.addFactory(
      null,
      {name: fnId, tags: ['history-client'], commands: historyClientCommands, properties: []},
      undefined,
      historyClientApi
    );

    const root = new Root();
    const queryMock = vi.fn().mockResolvedValue({
      table: {
        columns: [
          {name: 'time', type: 'date'},
          {name: 'value', type: 'number'},
        ],
        rows: [],
      },
      kind: 'number',
      interval: '1h',
      truncated: false,
      timezone: 'UTC',
    });
    const service = escapedObject<HistoryClient>('test:history-api', {
      timezone: 'UTC',
      record: () => {},
      listSeries: (search) => [{id: search ? `match:${search}` : 'sensor.a', kind: 'number'}],
      query: queryMock,
    });
    const block = root.defineGlobal('hist', {'#is': fnId, '#output': service});
    const [, conn] = makeLocalConnection(root, false);

    try {
      const listed = await conn.executeCommand('#global.^hist', 'listSeries', {search: 'temp'});
      expect(listed.result).toEqual({
        series: [{id: 'match:temp', kind: 'number'}],
        timezone: 'UTC',
      });

      const dtStart = DateTime.fromMillis(1_700_000_000_000, {zone: 'utc'});
      const dtEnd = DateTime.fromMillis(1_700_003_600_000, {zone: 'utc'});
      await conn.executeCommand('#global.^hist', 'query', {
        id: 'sensor.a',
        start: dtStart,
        end: dtEnd,
        interval: 'auto',
        rollup: 'max',
        limit: 50,
      });
      expect(queryMock).toHaveBeenCalledWith({
        id: 'sensor.a',
        start: 1_700_000_000_000,
        end: 1_700_003_600_000,
        interval: undefined,
        rollup: 'max',
        limit: 50,
      });

      await expect(
        conn.executeCommand('#global.^hist', 'query', {
          id: 'sensor.a',
          start: 'not-a-date',
          end: 1_700_003_600_000,
        })
      ).rejects.toThrow();

      // Test bad timestamp inside HistoryFunction block directly.
      const flow = root.addFlow('ErrFlow');
      const h = flow.createBlock('h');
      h._load({'#is': 'history', service, 'value': 1, 'time': 'bad-timestamp'});
      root.runAll();
      expect(ErrorEvent.check(h.getValue('#emit'))).toBeTruthy();
    } finally {
      destroyLastLocalConnection();
      root.destroy();
      globalFunctions.delete(fnId);
    }
  });

  it('resolves Factory DateTimes in default zone while keeping UTC DateTimes unchanged', () => {
    try {
      updateGlobalSettings(new DataWrapper({'#timezone': 'America/New_York'}));
      const dtFactory = toDateTime('2025-05-28T09:30:00', 'Factory');
      const dtNy = DateTime.fromISO('2025-05-28T09:30:00', {zone: 'America/New_York'});
      const dtUtc = DateTime.fromISO('2025-05-28T09:30:00', {zone: 'UTC'});

      expect(toHistoryEpochMs(dtFactory)).toBe(Math.trunc(dtNy.toMillis()));
      expect(toHistoryEpochMs(dtUtc)).toBe(Math.trunc(dtUtc.toMillis()));
    } finally {
      updateGlobalSettings();
    }
  });
});
