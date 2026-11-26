import {DateTime} from 'luxon';
import type {PropDesc} from '../../block/Descriptor.ts';

export type HistorySeriesKind = 'number' | 'boolean' | 'value';

export type HistoryRollupType =
  | 'avg'
  | 'min'
  | 'max'
  | 'sum'
  | 'count'
  | 'initial'
  | 'final'
  | 'first'
  | 'delta'
  | 'and'
  | 'or';

export const HISTORY_ROLLUPS: readonly HistoryRollupType[] = [
  'avg',
  'min',
  'max',
  'sum',
  'count',
  'initial',
  'final',
  'first',
  'delta',
  'and',
  'or',
];

export const HISTORY_INTERVALS = [
  'auto',
  'raw',
  '15s',
  '30s',
  '1m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '3h',
  '6h',
  '12h',
  '1d',
  '1w',
  '2w',
  '1n',
  '3n',
  '6n',
  '1y',
] as const;

export type HistoryIntervalOption = (typeof HISTORY_INTERVALS)[number];

export interface HistorySeriesInfo {
  id: string;
  kind: HistorySeriesKind;
  raw?: boolean;
  rollup15s?: boolean;
  rollup5m?: boolean;
  rollup1h?: boolean;
  rollup1d?: boolean;
}

export interface HistoryRecordOptions {
  kind?: HistorySeriesKind;
}

export interface HistoryQueryOptions {
  id: string;
  start: number;
  end: number;
  interval?: string | null;
  rollup?: HistoryRollupType;
  limit?: number;
}

export interface HistoryTable {
  columns: PropDesc[];
  rows: unknown[][];
}

export interface HistoryQueryResult {
  table: HistoryTable;
  kind: HistorySeriesKind;
  interval?: string | null;
  fallbackInterval?: string;
  truncated: boolean;
  timezone: string;
}

export interface HistoryClient {
  readonly timezone?: string;
  record(id: string, ts: number, value: unknown, options?: HistoryRecordOptions): void | Promise<void>;
  markInterruption?(id: string, ts?: number): void | Promise<void>;
  listSeries(search?: string): HistorySeriesInfo[] | Promise<HistorySeriesInfo[]>;
  query(options: HistoryQueryOptions): Promise<HistoryQueryResult>;
  deleteSeries?(id: string): Promise<void>;
}

export function toHistoryEpochMs(input: unknown): number | undefined {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.trunc(input) : undefined;
  }
  if (DateTime.isDateTime(input)) {
    return input.isValid ? Math.trunc(input.toMillis()) : undefined;
  }
  if (input instanceof Date) {
    const ms = input.getTime();
    return Number.isFinite(ms) ? Math.trunc(ms) : undefined;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const dt = DateTime.fromISO(trimmed, {setZone: true});
    if (dt.isValid) return Math.trunc(dt.toMillis());
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }
  if (input && typeof (input as {toMillis?: unknown}).toMillis === 'function') {
    const ms = (input as {toMillis(): number}).toMillis();
    return Number.isFinite(ms) ? Math.trunc(ms) : undefined;
  }
  return undefined;
}
