import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Input, InputNumber, Select, Table} from 'antd';
import {PlayCircleFilled, ReloadOutlined, SearchOutlined} from '@ant-design/icons';
import {DateTime} from 'luxon';
import type {DockLayout} from 'rc-dock';
import {
  HISTORY_INTERVALS,
  HISTORY_ROLLUPS,
  getZoneObject,
  historyClientCommands,
  type HistoryQueryResult,
  type HistoryRollupType,
  type HistorySeriesInfo,
  type HistoryTable,
} from '@ticlo/core';
import {type ClientConn, translateEditor} from '@ticlo/core/editor.ts';
import {RangePicker, getShowTimeRangeOption, normalizePickerDate} from '../component/DateTimePicker.tsx';
import {createDockDialog} from '../component/DockDialogPane.tsx';
import {EditPolicyProvider, useEditPolicy} from '../component/EditPolicyContext.tsx';
import {t} from '../component/LocalizedLabel.tsx';
import {renderValue} from '../component/renderValue.tsx';
import {useConnectionValue} from '../component/useConnectionValue.ts';

interface Props {
  conn: ClientConn;
  path: string;
}

const DEFAULT_LIMIT = 1000;
const PRESET_RANGES = [
  {key: '1h', label: '1h', ms: 3_600_000},
  {key: '24h', label: '24h', ms: 24 * 3_600_000},
  {key: '7d', label: '7d', ms: 7 * 86_400_000},
  {key: '30d', label: '30d', ms: 30 * 86_400_000},
] as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function makeDefaultRange(timezone?: string): [DateTime, DateTime] {
  const end = DateTime.now().setZone(timezone || 'local');
  return [end.minus({hours: 24}), end];
}

const HistoryResultTable = React.memo(function HistoryResultTable({table}: {table: HistoryTable}) {
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    let frame: number;
    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = Math.max(40, Math.floor(entry.contentRect.height) - 40);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHeight(nextHeight));
    });
    if (container.current) {
      observer.observe(container.current);
    }
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const columns = useMemo(
    () =>
      table.columns.map((column, index) => ({
        key: column.name,
        title: translateEditor(column.name === 'time' ? 'Time' : column.name === 'value' ? 'Value' : column.name),
        width: column.name === 'time' ? 240 : 300,
        ellipsis: true,
        render: (_: unknown, row: {values: unknown[]}) => renderValue(row.values[index]),
      })),
    [table]
  );

  const rows = useMemo(() => table.rows.map((values, key) => ({key, values})), [table]);

  return (
    <div className="ticl-e-history-table" ref={container}>
      <Table
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={false}
        virtual
        scroll={{
          x: Math.max(
            100,
            columns.reduce((sum, column) => sum + column.width, 0)
          ),
          y: height,
        }}
      />
    </div>
  );
});

function HistoryClientPanel({conn, path}: Props) {
  const service = useConnectionValue(conn, `${path}.#output`);
  const policy = useEditPolicy();

  const [seriesList, setSeriesList] = useState<HistorySeriesInfo[]>();
  const [timezone, setTimezone] = useState<string>('local');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [interval, setInterval] = useState<string>('auto');
  const [rollup, setRollup] = useState<HistoryRollupType>('avg');
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [range, setRange] = useState<[DateTime, DateTime]>(() => makeDefaultRange());

  const [refresh, setRefresh] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HistoryQueryResult>();
  const [error, setError] = useState<string>();
  const [listError, setListError] = useState<string>();

  const session = useRef({active: false, querySeq: 0});
  const listSession = useRef({id: 0, active: false});
  const target = useMemo(() => ({conn, path, service}), [conn, path, service]);
  const current = useRef(target);
  current.current = target;

  const request = useCallback(
    async (command: string, params?: Record<string, unknown>) => {
      const response = await conn.executeCommand(path, command, params, undefined, historyClientCommands[command]);
      return response?.result;
    },
    [conn, path]
  );

  const selectedSeries = useMemo(() => seriesList?.find((item) => item.id === selectedId), [seriesList, selectedId]);

  const filteredSeries = useMemo(() => {
    if (!seriesList) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return seriesList;
    return seriesList.filter((item) => item.id.toLowerCase().includes(needle));
  }, [seriesList, search]);

  const queryParams = useMemo(() => {
    if (!selectedSeries) return undefined;
    const isValue = selectedSeries.kind === 'value';
    return {
      id: selectedSeries.id,
      start: range[0].toMillis(),
      end: range[1].toMillis(),
      interval: isValue ? 'raw' : interval,
      rollup: isValue || interval === 'raw' ? undefined : rollup,
      limit,
    };
  }, [selectedSeries, range, interval, rollup, limit]);

  const canExecute = Boolean(
    queryParams && policy.can({cmd: 'executeCommand' as const, path, command: 'query', params: queryParams})
  );

  const executeQuery = useCallback(
    async (override?: {
      series?: HistorySeriesInfo;
      range?: [DateTime, DateTime];
      interval?: string;
      rollup?: HistoryRollupType;
      limit?: number;
    }) => {
      const targetSeries = override?.series ?? selectedSeries;
      const targetRange = override?.range ?? range;
      const targetInterval = override?.interval ?? interval;
      const targetRollup = override?.rollup ?? rollup;
      const targetLimit = override?.limit ?? limit;

      if (!service || !targetSeries) return;
      const isValue = targetSeries.kind === 'value';
      const params = {
        id: targetSeries.id,
        start: targetRange[0].toMillis(),
        end: targetRange[1].toMillis(),
        interval: isValue ? 'raw' : targetInterval,
        rollup: isValue || targetInterval === 'raw' ? undefined : targetRollup,
        limit: targetLimit,
      };
      if (!conn.getEditPolicyView().can({cmd: 'executeCommand', path, command: 'query', params})) return;

      const revision = session.current;
      const seq = ++revision.querySeq;
      setRunning(true);
      setError(undefined);
      try {
        const res = (await request('query', params)) as HistoryQueryResult;
        if (revision.active && revision.querySeq === seq && current.current === target) {
          setResult(res);
        }
      } catch (err) {
        if (revision.active && revision.querySeq === seq && current.current === target) {
          setResult(undefined);
          setError(errorMessage(err));
        }
      } finally {
        if (revision.active && revision.querySeq === seq && current.current === target) {
          setRunning(false);
        }
      }
    },
    [service, selectedSeries, range, interval, rollup, limit, conn, path, request, target]
  );

  useEffect(() => {
    const revision = {active: true, querySeq: 0};
    session.current = revision;
    setResult(undefined);
    setError(undefined);
    setRunning(false);
    return () => {
      revision.active = false;
    };
  }, [target]);

  useEffect(() => {
    const revision = {id: listSession.current.id + 1, active: true};
    listSession.current = revision;
    setSeriesList(undefined);
    setListError(undefined);
    if (service) {
      request('listSeries').then(
        (res: {series?: HistorySeriesInfo[]; timezone?: string}) => {
          if (!revision.active || current.current !== target) return;
          const list = res?.series ?? [];
          const nextZone = res?.timezone || 'local';
          setTimezone(nextZone);
          setSeriesList(list);
          setRange((prev) => {
            const zoneObj = getZoneObject(nextZone);
            return [DateTime.fromMillis(prev[0].toMillis(), zoneObj), DateTime.fromMillis(prev[1].toMillis(), zoneObj)];
          });
          setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id));
        },
        (err) => {
          if (!revision.active || current.current !== target) return;
          setListError(errorMessage(err));
          setSeriesList([]);
        }
      );
    }
    return () => {
      revision.active = false;
    };
  }, [service, refresh, request, target]);

  const intervalOptions = useMemo(() => HISTORY_INTERVALS.map((value) => ({label: value, value})), []);
  const rollupOptions = useMemo(() => HISTORY_ROLLUPS.map((value) => ({label: value, value})), []);

  const showTimeOption = useMemo(() => getShowTimeRangeOption(timezone), [timezone]);
  const isValueSeries = selectedSeries?.kind === 'value';

  return (
    <div className="ticl-e-history-client">
      <div className="ticl-e-history-list">
        <div className="ticl-e-history-toolbar">
          <strong>{t('Histories')}</strong>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            title={translateEditor('Refresh')}
            disabled={!service || running}
            onClick={() => setRefresh((value) => value + 1)}
          />
        </div>
        <Input
          className="ticl-e-history-search"
          size="small"
          allowClear
          prefix={<SearchOutlined />}
          placeholder={translateEditor('Search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {listError ? <Alert type="error" title={listError} /> : null}
        <div className="ticl-e-history-items">
          {service ? (
            seriesList ? (
              filteredSeries.length > 0 ? (
                filteredSeries.map((item) => (
                  <div
                    key={item.id}
                    className={
                      item.id === selectedId
                        ? 'ticl-e-history-item ticl-e-history-item-selected'
                        : 'ticl-e-history-item'
                    }
                    title={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      void executeQuery({series: item});
                    }}
                  >
                    <span className="ticl-e-history-item-id">{item.id}</span>
                    <span className="ticl-e-history-kind">{item.kind}</span>
                  </div>
                ))
              ) : (
                <div className="ticl-e-history-empty">{t('No histories')}</div>
              )
            ) : (
              <div className="ticl-e-history-empty">{t('Loading...')}</div>
            )
          ) : (
            <div className="ticl-e-history-empty">{t('History client is not ready')}</div>
          )}
        </div>
      </div>

      <div className="ticl-e-history-main">
        <div className="ticl-e-history-controls">
          <div className="ticl-e-history-range-presets">
            {PRESET_RANGES.map((preset) => (
              <Button
                key={preset.key}
                size="small"
                disabled={!service}
                onClick={() => {
                  const end = DateTime.now().setZone(timezone || 'local');
                  const nextRange: [DateTime, DateTime] = [end.minus({milliseconds: preset.ms}), end];
                  setRange(nextRange);
                  if (selectedSeries) {
                    void executeQuery({range: nextRange});
                  }
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <RangePicker
            size="small"
            value={range}
            allowClear={false}
            showTime={showTimeOption}
            disabled={!service}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                const targetZone = timezone || 'local';
                const nextRange: [DateTime, DateTime] = [
                  normalizePickerDate(dates[0], targetZone, true),
                  normalizePickerDate(dates[1], targetZone, true),
                ];
                if (nextRange[0].isValid && nextRange[1].isValid) {
                  setRange(nextRange);
                }
              }
            }}
          />
          <label className="ticl-e-history-field">
            <span>{t('Interval')}</span>
            <Select
              size="small"
              className="ticl-e-history-interval-select"
              value={isValueSeries ? 'raw' : interval}
              options={intervalOptions}
              disabled={!service || !selectedSeries || isValueSeries}
              onChange={(val) => {
                setInterval(val);
                if (selectedSeries) {
                  void executeQuery({interval: val});
                }
              }}
            />
          </label>
          <label className="ticl-e-history-field">
            <span>{t('Rollup')}</span>
            <Select
              size="small"
              className="ticl-e-history-rollup-select"
              value={rollup}
              options={rollupOptions}
              disabled={!service || !selectedSeries || isValueSeries || interval === 'raw'}
              onChange={(val) => {
                setRollup(val);
                if (selectedSeries) {
                  void executeQuery({rollup: val});
                }
              }}
            />
          </label>
          <label className="ticl-e-history-field">
            <span>{t('Limit')}</span>
            <InputNumber
              size="small"
              className="ticl-e-history-limit-input"
              min={1}
              max={100000}
              value={limit}
              disabled={!service || !selectedSeries}
              onChange={(val) => {
                if (typeof val === 'number' && Number.isFinite(val) && val >= 1) {
                  setLimit(Math.floor(val));
                }
              }}
            />
          </label>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleFilled />}
            loading={running}
            disabled={!service || !selectedSeries || !canExecute}
            onClick={() => void executeQuery()}
          >
            {t('Run')}
          </Button>
        </div>

        {result ? (
          <div className="ticl-e-history-status">
            <span>
              {t('Rows')}: {result.table.rows.length}
            </span>
            <span>
              {t('Interval')}: {result.interval === null ? 'raw' : result.interval}
            </span>
            {result.fallbackInterval ? (
              <span>
                {t('Fallback')}: {result.fallbackInterval}
              </span>
            ) : null}
            {result.truncated ? <span className="ticl-e-history-truncated">{t('Truncated')}</span> : null}
            <span className="ticl-e-history-zone">{result.timezone}</span>
          </div>
        ) : null}

        {error ? <Alert type="error" title={error} /> : null}
        {result?.table ? <HistoryResultTable table={result.table} /> : null}
      </div>
    </div>
  );
}

export function HistoryClientDialog({conn, path}: Props) {
  return (
    <EditPolicyProvider conn={conn}>
      <HistoryClientPanel conn={conn} path={path} />
    </EditPolicyProvider>
  );
}

export function openHistoryClientDialog(layout: DockLayout, conn: ClientConn, path: string) {
  createDockDialog(
    layout,
    `${translateEditor('Manage history')} — ${path}`,
    <HistoryClientDialog conn={conn} path={path} />,
    `history-client-${path}`,
    {preferredWidth: 1000, preferredHeight: 650}
  );
}
