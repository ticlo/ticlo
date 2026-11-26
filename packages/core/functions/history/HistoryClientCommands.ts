import type {FunctionApi} from '../../block/BlockFunction.ts';
import type {FunctionCommandDesc} from '../../block/Descriptor.ts';
import {getDefaultZone} from '../../util/Settings.ts';
import {
  HISTORY_INTERVALS,
  HISTORY_ROLLUPS,
  toHistoryEpochMs,
  type HistoryClient,
  type HistoryRollupType,
} from './HistoryClient.ts';

/** Shared by history services; opening the management dialog is a frontend concern. */
export const historyClientCommands: Record<string, FunctionCommandDesc> = {
  listSeries: {
    parameters: [{name: 'search', type: 'string'}],
    results: [
      {
        name: 'series',
        type: 'table',
        rowType: 'object',
        columns: [
          {key: 'id', type: 'string'},
          {key: 'kind', type: 'select', options: ['number', 'boolean', 'value']},
          {key: 'raw', type: 'toggle'},
          {key: 'rollup15s', type: 'toggle'},
          {key: 'rollup5m', type: 'toggle'},
          {key: 'rollup1h', type: 'toggle'},
          {key: 'rollup1d', type: 'toggle'},
        ],
      },
      {name: 'timezone', type: 'string'},
    ],
    readonly: true,
  },
  query: {
    parameters: [
      {name: 'id', type: 'string'},
      {name: 'start', type: 'date'},
      {name: 'end', type: 'date'},
      {name: 'interval', type: 'select', options: HISTORY_INTERVALS, default: 'auto'},
      {name: 'rollup', type: 'select', options: HISTORY_ROLLUPS, default: 'avg'},
      {name: 'limit', type: 'number', default: 1000, min: 1},
    ],
    results: [
      {name: 'table', type: 'table'},
      {name: 'kind', type: 'string'},
      {name: 'interval', type: 'string'},
      {name: 'fallbackInterval', type: 'string'},
      {name: 'truncated', type: 'toggle'},
      {name: 'timezone', type: 'string'},
    ],
    largeData: true,
    readonly: true,
  },
};

export const historyClientApi: FunctionApi = {
  commands: {
    async listSeries(block, {search} = {}) {
      if (search !== undefined && typeof search !== 'string') {
        throw new Error('Search filter must be a string');
      }
      const client = block.getValue('#output') as HistoryClient;
      if (!client?.listSeries) throw new Error('History client is not ready');
      return {
        series: await client.listSeries(search as string | undefined),
        timezone: client.timezone ?? getDefaultZone(),
      };
    },
    async query(block, {id, start, end, interval, rollup, limit} = {}) {
      if (typeof id !== 'string' || !id) {
        throw new Error('Series ID is required');
      }
      const startMs = toHistoryEpochMs(start);
      const endMs = toHistoryEpochMs(end);
      if (startMs === undefined || endMs === undefined) {
        throw new Error('Valid start and end timestamps are required');
      }
      let resolvedInterval: string | null | undefined;
      if (interval === 'raw' || interval === null) {
        resolvedInterval = null;
      } else if (interval === 'auto' || interval === undefined || interval === '') {
        resolvedInterval = undefined;
      } else if (typeof interval === 'string') {
        resolvedInterval = interval;
      } else {
        throw new Error('Invalid interval');
      }

      if (
        rollup !== undefined &&
        (typeof rollup !== 'string' || !HISTORY_ROLLUPS.includes(rollup as HistoryRollupType))
      ) {
        throw new Error('Invalid rollup type');
      }
      if (limit !== undefined && (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0)) {
        throw new Error('Invalid limit');
      }

      const client = block.getValue('#output') as HistoryClient;
      if (!client?.query) throw new Error('History client is not ready');
      return await client.query({
        id,
        start: startMs,
        end: endMs,
        interval: resolvedInterval,
        rollup: rollup as HistoryRollupType | undefined,
        limit: limit as number | undefined,
      });
    },
  },
};
