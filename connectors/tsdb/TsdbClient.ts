import {
  MemoryBackend,
  Tsdb,
  type RollupType,
  type SeriesConfig,
  type SeriesKind,
  type StorageLimitOptions,
  type TsdbOptions,
} from 'ticlo-tsdb';
import {
  decode,
  encode,
  resolveZone,
  smartStrCompare,
  toDateTime,
  type HistoryClient,
  type HistoryQueryOptions,
  type HistoryQueryResult,
  type HistoryRecordOptions,
  type HistoryRollupType,
  type HistorySeriesInfo,
  type HistorySeriesKind,
} from '@ticlo/core';

export interface TsdbClientOptions {
  filePath: string;
  timezone?: string;
  flushIntervalMs?: number;
  raw?: boolean;
  rollup15s?: boolean;
  rollup5m?: boolean;
  rollup1h?: boolean;
  rollup1d?: boolean;
  rawNumericMaxMB?: number;
  rawValueMaxMB?: number;
  rollupMaxMB?: number;
}

const ticloValueCodec = {
  stringify: encode,
  parse: decode,
};

const BOOLEAN_PRESERVING_ROLLUPS = new Set<HistoryRollupType>(['min', 'max', 'initial', 'final', 'first', 'and', 'or']);

function inferSeriesKind(value: unknown): SeriesKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'value';
}

function mbToBytes(mb: unknown): number | undefined {
  if (typeof mb !== 'number' || !Number.isFinite(mb) || mb <= 0) return undefined;
  return Math.floor(mb * 1024 * 1024);
}

export class TsdbClient implements HistoryClient {
  readonly db: Tsdb;
  readonly timezone: string;
  private readonly pendingCreates = new Map<string, Promise<void>>();
  private closed = false;

  private constructor(db: Tsdb) {
    this.db = db;
    this.timezone = db.calendar.timezone;
  }

  static async open(options: TsdbClientOptions): Promise<TsdbClient> {
    const timezone = resolveZone(options.timezone);
    const defaultSeriesConfig: Partial<Omit<SeriesConfig, 'kind'>> = {
      raw: options.raw ?? true,
      rollup15s: options.rollup15s ?? false,
      rollup5m: options.rollup5m ?? false,
      rollup1h: options.rollup1h ?? true,
      rollup1d: options.rollup1d ?? true,
    };

    const rawNumericMaxBytes = mbToBytes(options.rawNumericMaxMB);
    const rawValueMaxBytes = mbToBytes(options.rawValueMaxMB);
    const rollupMaxBytes = mbToBytes(options.rollupMaxMB);
    let storageLimits: StorageLimitOptions | undefined;
    if (rawNumericMaxBytes !== undefined || rawValueMaxBytes !== undefined || rollupMaxBytes !== undefined) {
      storageLimits = {
        ...(rawNumericMaxBytes !== undefined ? {rawNumericMaxBytes} : undefined),
        ...(rawValueMaxBytes !== undefined ? {rawValueMaxBytes} : undefined),
        ...(rollupMaxBytes !== undefined ? {rollupMaxBytes} : undefined),
      };
    }

    const useMemory = !options.filePath || options.filePath === ':memory:';
    const tsdbOptions: TsdbOptions = {
      ...(useMemory ? {backend: new MemoryBackend()} : {dir: options.filePath}),
      valueCodec: ticloValueCodec,
      timezone,
      ...(options.flushIntervalMs !== undefined ? {flushIntervalMs: options.flushIntervalMs} : undefined),
      defaultSeriesConfig,
      ...(storageLimits ? {storageLimits} : undefined),
    };

    const db = await Tsdb.open(tsdbOptions);
    return new TsdbClient(db);
  }

  private writeWithKind(id: string, ts: number, value: unknown, kind: SeriesKind): void {
    if (kind === 'value') {
      this.db.write(id, ts, value);
      return;
    }
    if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
      this.db.markInterruption(id, ts);
      return;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      this.db.writeNumeric(id, ts, value);
      return;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        this.db.writeNumeric(id, ts, kind === 'boolean' ? parsed !== 0 : parsed);
        return;
      }
    }
    throw new Error(`Numeric series "${id}" requires number or boolean value`);
  }

  record(id: string, ts: number, value: unknown, options?: HistoryRecordOptions): void | Promise<void> {
    if (this.closed) {
      throw new Error('TSDB client is closed');
    }
    const existing = this.db.getSeriesMeta(id);
    if (existing && !this.pendingCreates.has(id)) {
      this.writeWithKind(id, ts, value, existing.config.kind);
      return;
    }

    let pending = this.pendingCreates.get(id);
    if (!pending) {
      const kind: SeriesKind = options?.kind ?? inferSeriesKind(value);
      const config: SeriesConfig = {
        kind,
      };
      pending = this.db.ensureSeries(id, config).then(
        () => {
          this.pendingCreates.delete(id);
        },
        (err) => {
          this.pendingCreates.delete(id);
          throw err;
        }
      );
      this.pendingCreates.set(id, pending);
    }

    return pending.then(() => {
      if (this.closed) {
        throw new Error('TSDB client is closed');
      }
      const meta = this.db.getSeriesMeta(id);
      if (!meta) {
        throw new Error(`Failed to initialize series "${id}"`);
      }
      this.writeWithKind(id, ts, value, meta.config.kind);
    });
  }

  async markInterruption(id: string, ts?: number): Promise<void> {
    if (this.closed) throw new Error('TSDB client is closed');
    const pending = this.pendingCreates.get(id);
    if (pending) await pending;
    const meta = this.db.getSeriesMeta(id);
    if (meta && meta.config.kind !== 'value') {
      this.db.markInterruption(id, ts);
    }
  }

  listSeries(search?: string): HistorySeriesInfo[] {
    if (this.closed) throw new Error('TSDB client is closed');
    const needle = search?.trim().toLowerCase();
    const list: HistorySeriesInfo[] = [];
    for (const meta of this.db.listSeries()) {
      if (needle && !meta.id.toLowerCase().includes(needle)) continue;
      list.push({
        id: meta.id,
        kind: meta.config.kind as HistorySeriesKind,
        raw: meta.config.raw.enabled,
        rollup15s: meta.config.rollup15s.enabled,
        rollup5m: meta.config.rollup5m.enabled,
        rollup1h: meta.config.rollup1h.enabled,
        rollup1d: meta.config.rollup1d.enabled,
      });
    }
    list.sort((a, b) => smartStrCompare(a.id, b.id));
    return list;
  }

  async query(options: HistoryQueryOptions): Promise<HistoryQueryResult> {
    if (this.closed) throw new Error('TSDB client is closed');
    const pending = this.pendingCreates.get(options.id);
    if (pending) await pending;

    const meta = this.db.getSeriesMeta(options.id);
    if (!meta) {
      throw new Error(`Unknown history series: ${options.id}`);
    }

    const kind = meta.config.kind as HistorySeriesKind;
    const limit = options.limit;

    if (kind === 'value') {
      const res = await this.db.queryValues(options.id, {
        start: options.start,
        end: options.end,
        limit,
      });
      const rows: unknown[][] = new Array(res.points.length);
      for (let i = 0; i < res.points.length; ++i) {
        const pt = res.points[i];
        rows[i] = [toDateTime(pt.ts, this.timezone), pt.value];
      }
      return {
        table: {
          columns: [
            {name: 'time', type: 'date'},
            {name: 'value', type: 'any'},
          ],
          rows,
        },
        kind,
        interval: null,
        truncated: res.truncated,
        timezone: res.timezone,
      };
    }

    let intervalArg: string | null | undefined;
    if (options.interval === 'raw' || options.interval === null) {
      intervalArg = null;
    } else if (options.interval === 'auto' || options.interval === undefined || options.interval === '') {
      intervalArg = undefined;
    } else {
      intervalArg = options.interval;
    }

    const rollup = (options.rollup ?? 'avg') as RollupType;
    const res = await this.db.queryNumericColumns(options.id, {
      start: options.start,
      end: options.end,
      interval: intervalArg as any,
      rollup,
      limit,
    });

    const isRawMode = res.interval === null && res.fallbackInterval === undefined;
    const asBool = kind === 'boolean' && (isRawMode || BOOLEAN_PRESERVING_ROLLUPS.has(rollup));

    const rows: unknown[][] = new Array(res.length);
    for (let i = 0; i < res.length; ++i) {
      const rawVal = res.values[i];
      const cellVal = asBool ? (Number.isNaN(rawVal) ? null : rawVal !== 0) : rawVal;
      rows[i] = [toDateTime(res.timestamps[i], this.timezone), cellVal];
    }

    return {
      table: {
        columns: [
          {name: 'time', type: 'date'},
          {name: 'value', type: asBool ? 'toggle' : 'number'},
        ],
        rows,
      },
      kind,
      interval: res.interval,
      ...(res.fallbackInterval !== undefined ? {fallbackInterval: res.fallbackInterval} : undefined),
      truncated: res.truncated,
      timezone: res.timezone,
    };
  }

  deleteSeries(id: string): Promise<void> {
    if (this.closed) return Promise.reject(new Error('TSDB client is closed'));
    return this.db.deleteSeries(id);
  }

  flush(): Promise<void> {
    if (this.closed) return Promise.resolve();
    return this.db.flush();
  }

  close(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.closed = true;
    return this.db.close();
  }
}
