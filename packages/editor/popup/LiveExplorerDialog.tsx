import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {Button} from 'antd';
import type {DockLayout} from 'rc-dock';
import {
  encodeDisplay,
  MAX_LIVE_TARGETS,
  type ClientConn,
  type DataMap,
  type LiveCapabilities,
  type LiveEvent,
  type LivePage,
  type LivePageRequest,
  type LiveRow,
  type LiveUpdate,
} from '@ticlo/core';
import {createDockDialog, DockDialogPane} from '../component/DockDialogPane.tsx';
import {EditPolicyProvider, useEditPolicy} from '../component/EditPolicyContext.tsx';
import {t} from '../component/LocalizedLabel.tsx';
import {translateEditor} from '@ticlo/core/editor.ts';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import VirtualList from '../component/Virtual.tsx';
import {CommandMenu, CommandValue} from './CommandMenu.tsx';

interface Props {
  conn: ClientConn;
  path: string;
}

const PAGE_SIZE = 100;
const RANGE_MARGIN = 4;
const sourceDesc = {name: 'liveSource'};
const emptyTargets: string[] = [];
const initialRange = [0, 0] as const;

function useConnected(conn: ClientConn) {
  const transport = conn.getBaseConn();
  const subscribe = useCallback(
    (listener: () => void) => {
      transport.connectionChanges.listen(listener);
      return () => transport.connectionChanges.unlisten(listener);
    },
    [transport]
  );
  const snapshot = useCallback(() => transport.connectionChanges.value, [transport]);
  return useSyncExternalStore(subscribe, snapshot);
}

function usePanelVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    let intersecting = false;
    const update = () => setVisible(intersecting && !element.ownerDocument.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    element.ownerDocument.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      element.ownerDocument.removeEventListener('visibilitychange', update);
    };
  }, []);
  return {ref, visible};
}

interface RowSnapshot {
  event: LiveUpdate['event'];
  stale: boolean;
}

class RowValues {
  private values = new Map<string, RowSnapshot>();
  private listeners = new Map<string, Set<() => void>>();
  private active = new Set<string>();

  read(target: string) {
    return this.values.get(target);
  }

  listen(target: string, listener: () => void) {
    let listeners = this.listeners.get(target);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(target, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(target);
    };
  }

  private notify(target: string) {
    for (const listener of this.listeners.get(target) ?? []) listener();
  }

  targets(targets: string[]) {
    const next = new Set(targets);
    for (const target of this.active) {
      if (!next.has(target)) {
        const previous = this.values.get(target);
        if (previous && !previous.stale) {
          this.values.set(target, {...previous, stale: true});
          this.notify(target);
        }
      }
    }
    this.active = next;
  }

  update(updates: LiveUpdate[]) {
    for (const {target, event} of updates) {
      if (!this.active.has(target)) continue;
      if (event.type === 'status' && event.status === 'connected') continue;
      const previous = this.values.get(target);
      this.values.delete(target);
      const disconnected = event.type === 'gap' || (event.type === 'status' && event.status !== 'error');
      this.values.set(target, {
        event: disconnected && previous ? previous.event : event,
        stale: disconnected || (event.type === 'snapshot' && event.meta?.cached === true),
      });
      if (this.values.size > 1024) {
        for (const key of this.values.keys()) {
          if (!this.active.has(key)) {
            this.values.delete(key);
            break;
          }
        }
      }
      this.notify(target);
    }
  }
}

function formatEvent(event: LiveUpdate['event']) {
  if ('value' in event) return typeof event.value === 'string' ? event.value : encodeDisplay(event.value);
  if (event.type === 'status') return event.message ?? event.status;
  if (event.type === 'remove')
    return event.reason === 'deleted' ? translateEditor('Deleted') : translateEditor('Left query');
  return event.type === 'gap' && event.dropped
    ? translateEditor('Updates skipped') + ' · ' + event.dropped
    : translateEditor('Updates skipped');
}

interface RowProps {
  row: LiveRow;
  depth: number;
  style: React.CSSProperties;
  store: RowValues;
  expanded: boolean;
  toggle?: () => void;
}

const ExplorerRow = React.memo(function ExplorerRow({row, depth, style, store, expanded, toggle}: RowProps) {
  const subscribe = useCallback(
    (listener: () => void) => (row.target === undefined ? () => {} : store.listen(row.target, listener)),
    [row.target, store]
  );
  const snapshot = useCallback(() => store.read(row.target), [row.target, store]);
  const live = useSyncExternalStore(subscribe, snapshot);
  const value = live ? formatEvent(live.event) : row.preview;
  const time = live && 'time' in live.event ? live.event.time : row.observedAt;
  return (
    <div className="ticl-e-live-row" style={{...style, paddingInlineStart: depth * 16 + 8}} data-live-row={row.id}>
      {toggle && (
        <button
          type="button"
          className="ticl-e-live-expand"
          onClick={toggle}
          title={translateEditor(expanded ? 'Collapse' : 'Expand')}
        >
          {expanded ? '▾' : '▸'}
        </button>
      )}
      <span className="ticl-e-live-label" title={row.id}>
        {row.label || '/'}
      </span>
      <code className="ticl-e-live-preview" title={value}>
        {value}
      </code>
      {value !== undefined && (
        <small>
          {live && !live.stale ? t('Live') : t('Snapshot')}
          {time ? ' · ' + new Date(time).toLocaleTimeString() : ''}
        </small>
      )}
    </div>
  );
});

interface PageState extends LivePage {
  loading?: boolean;
  error?: string;
}

type ListEntry = {row: LiveRow; depth: number} | {parent?: string; depth: number; page: PageState};

function PagedResults({
  conn,
  path,
  fetchPage,
  watch,
  visible,
  liveQuery,
}: Props & {
  fetchPage: (parent: string | undefined, page: LivePageRequest) => Promise<LivePage>;
  watch: boolean;
  visible: boolean;
  liveQuery?: DataMap;
}) {
  const [pages, setPages] = useState(() => new Map<string | undefined, PageState>());
  const pending = useRef(new Map<string | undefined, object>());
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [range, setRange] = useState<readonly [number, number]>(initialRange);
  const [store] = useState(() => new RowValues());
  const [id, setId] = useState<string>();
  const [error, setError] = useState<string>();
  const load = useCallback(
    (parent?: string, cursor?: string) => {
      if (pending.current.has(parent)) return;
      const token = {};
      pending.current.set(parent, token);
      const updatePage = (update: (previous: PageState) => PageState) =>
        setPages((previous) => new Map(previous).set(parent, update(previous.get(parent) ?? {rows: []})));
      updatePage((previous) => ({...previous, loading: true, error: undefined}));
      fetchPage(parent, {limit: PAGE_SIZE, cursor}).then(
        (page) => {
          if (pending.current.get(parent) !== token) return;
          pending.current.delete(parent);
          updatePage((previous) => {
            if (cursor === undefined) return page;
            const known = new Set(previous.rows.map((row) => row.id));
            return {...page, rows: [...previous.rows, ...page.rows.filter((row) => !known.has(row.id))]};
          });
        },
        (failure) => {
          if (pending.current.get(parent) !== token) return;
          pending.current.delete(parent);
          updatePage((previous) => ({...previous, loading: false, error: String(failure)}));
        }
      );
    },
    [fetchPage]
  );

  useEffect(() => {
    const requests = pending.current;
    if (!liveQuery) load();
    return () => requests.clear();
  }, [load, liveQuery]);

  const [queryError, setQueryError] = useState<string>();
  useEffect(() => {
    if (!liveQuery || !visible) return;
    setQueryError(undefined);
    const request = conn.watchLive(
      path,
      {query: liveQuery, limit: PAGE_SIZE},
      (updates) => {
        for (const {event} of updates) {
          if (event.type === 'results') setPages(new Map([[undefined, {rows: event.rows}]]));
          if (event.type === 'status' && event.status === 'error') setQueryError(event.message ?? event.status);
        }
      },
      setQueryError
    );
    return () => conn.cancel(request);
  }, [conn, path, liveQuery, visible]);

  const entries = useMemo(() => {
    const result: ListEntry[] = [];
    function append(parent: string | undefined, depth: number) {
      const page = pages.get(parent);
      if (!page) return;
      for (const row of page.rows) {
        result.push({row, depth});
        if (row.branch !== undefined && expanded.has(row.branch)) append(row.branch, depth + 1);
      }
      if (page.cursor !== undefined || page.loading || page.error) result.push({parent, depth, page});
    }
    append(undefined, 0);
    return result;
  }, [pages, expanded]);

  const targets = useMemo(() => {
    if (!watch || !visible || range[0] === range[1]) return emptyTargets;
    const current = new Set<string>();
    const from = Math.max(0, range[0] - RANGE_MARGIN);
    const to = Math.min(entries.length, range[1] + RANGE_MARGIN);
    for (let i = from; i < to && current.size < MAX_LIVE_TARGETS; ++i) {
      const entry = entries[i];
      if ('row' in entry && entry.row.target !== undefined) current.add(entry.row.target);
    }
    return [...current];
  }, [entries, range, watch, visible]);

  const stream = watch && visible;
  useEffect(() => {
    setError(undefined);
    if (!stream) {
      setId(undefined);
      return;
    }
    let active = true;
    const request = conn.watchLive(
      path,
      {targets: []},
      (updates) => {
        if (active) store.update(updates);
      },
      (failure) => {
        if (active) {
          store.targets([]);
          setId(undefined);
          setError(failure);
        }
      }
    );
    setId(request);
    return () => {
      active = false;
      conn.cancel(request);
    };
  }, [conn, path, store, stream]);

  useEffect(() => {
    store.targets(id ? targets : emptyTargets);
    if (!id || !stream) return;
    let active = true;
    const timer = setTimeout(() => {
      void conn.setLiveTargets(path, id, targets).catch((failure) => {
        if (active) setError(String(failure));
      });
    }, 32);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [conn, id, path, store, stream, targets]);

  const onRangeChange = useCallback((start: number, end: number) => {
    setRange((current) => (current[0] === start && current[1] === end ? current : [start, end]));
  }, []);

  return (
    <>
      {(error || queryError) && <div className="ticl-e-error-message">{error || queryError}</div>}
      {!entries.length && <div className="ticl-e-live-empty">{t('No results')}</div>}
      <VirtualList
        className="ticl-e-live-list"
        itemCount={entries.length}
        itemHeight={32}
        onRangeChange={onRangeChange}
        renderer={(index, style) => {
          const entry = entries[index];
          if ('page' in entry) {
            const {parent, depth, page} = entry;
            return (
              <div
                key={JSON.stringify(['page', parent])}
                className="ticl-e-live-row"
                style={{...style, paddingInlineStart: depth * 16 + 8}}
              >
                {page.loading ? (
                  t('Loading')
                ) : (
                  <Button size="small" onClick={() => load(parent, page.cursor)}>
                    {page.error ? t('Retry') : t('Load more')}
                  </Button>
                )}
                {page.error && <span className="ticl-e-error-message">{page.error}</span>}
              </div>
            );
          }
          const {row, depth} = entry;
          const branch = row.branch;
          const open = expanded.has(branch);
          return (
            <ExplorerRow
              key={JSON.stringify(['row', row.id])}
              row={row}
              depth={depth}
              style={style}
              store={store}
              expanded={open}
              toggle={
                branch === undefined
                  ? undefined
                  : () => {
                      const next = new Set(expanded);
                      if (open) next.delete(branch);
                      else {
                        next.add(branch);
                        if (!pages.has(branch)) load(branch);
                      }
                      setExpanded(next);
                    }
              }
            />
          );
        }}
      />
    </>
  );
}

function CaptureResults({conn, path, query, follow}: Props & {query: DataMap; follow: boolean}) {
  const [events, setEvents] = useState<LiveUpdate[]>([]);
  const [status, setStatus] = useState(translateEditor(follow ? 'Listening' : 'Sampling'));
  useEffect(() => {
    const id = conn.watchLive(
      path,
      {capture: query, follow},
      (updates) => {
        if (updates.some(({event}) => event.type === 'status' && event.status === 'closed')) {
          setStatus(translateEditor('Sample complete'));
          conn.cancel(id);
        }
        const messages = updates.filter(({event}) => event.type !== 'status' || event.status === 'error');
        if (messages.length) setEvents((previous) => [...previous, ...messages].slice(-256));
      },
      setStatus
    );
    return () => conn.cancel(id);
  }, [conn, path, query, follow]);

  return (
    <>
      <div className="ticl-e-live-toolbar">{status}</div>
      <VirtualList
        className="ticl-e-live-list"
        itemCount={events.length}
        itemHeight={32}
        renderer={(index, style) => {
          const {event} = events[events.length - 1 - index];
          const topic = 'meta' in event ? String(event.meta?.topic ?? '') : '';
          return (
            <div className="ticl-e-live-row" style={style} key={index}>
              <span className="ticl-e-live-label">{topic}</span>
              <code className="ticl-e-live-preview">{formatEvent(event)}</code>
            </div>
          );
        }}
      />
    </>
  );
}

function Explorer({conn, path, capabilities, visible}: Props & {capabilities: LiveCapabilities; visible: boolean}) {
  const [mode, setMode] = useState(capabilities.tree ? 'tree' : 'query');
  const [draft, setDraft] = useState<DataMap>(() =>
    Object.fromEntries((capabilities.search?.fields ?? []).map((field) => [field.name, field.init ?? field.default]))
  );
  const [query, setQuery] = useState(draft);
  const [revision, refresh] = useState(0);
  const [liveTree, setLiveTree] = useState(true);
  const [liveSearch, setLiveSearch] = useState(false);
  const [live, setLive] = mode === 'tree' ? [liveTree, setLiveTree] : [liveSearch, setLiveSearch];
  const [liveQuery, setLiveQuery] = useState(false);
  const [capture, setCapture] = useState<{query: DataMap; follow: boolean}>();
  const [publish, setPublish] = useState(false);
  const policy = useEditPolicy();
  const canPublish = capabilities.publish && policy.can({cmd: 'executeCommand', path, command: 'publish'});
  const fetchPage = useCallback(
    (parent: string | undefined, page: LivePageRequest) =>
      mode === 'tree' ? conn.listLiveChildren(path, parent, page) : conn.searchLive(path, query, page),
    [conn, mode, path, query]
  );

  useEffect(() => {
    if (!visible) setCapture(undefined);
  }, [visible]);

  return (
    <>
      <div className="ticl-e-live-toolbar">
        {capabilities.tree && capabilities.search && (
          <>
            <Button
              type={mode === 'tree' ? 'primary' : 'default'}
              onClick={() => {
                setCapture(undefined);
                setMode('tree');
              }}
            >
              {t('Tree')}
            </Button>
            <Button type={mode === 'query' ? 'primary' : 'default'} onClick={() => setMode('query')}>
              {t('Search')}
            </Button>
          </>
        )}
        {mode === 'query' &&
          capabilities.search?.fields.map((field) => (
            <CommandValue
              key={field.name}
              desc={field}
              funcDesc={sourceDesc}
              label={field.name}
              value={draft[field.name]}
              onChange={(value, name) => setDraft((previous) => ({...previous, [name]: value}))}
            />
          ))}
        <Button
          onClick={() => {
            setCapture(undefined);
            setQuery(draft);
            refresh(revision + 1);
          }}
        >
          {mode === 'tree' ? t('Refresh') : t('Run search')}
        </Button>
        {mode === 'query' && capabilities.liveQuery && (
          <Button
            type={liveQuery ? 'primary' : 'default'}
            onClick={() => {
              setCapture(undefined);
              setLiveQuery(!liveQuery);
              refresh(revision + 1);
            }}
          >
            {liveQuery ? t('Pause live query') : t('Run live query')}
          </Button>
        )}
        {capabilities.liveRows && !(mode === 'query' && liveQuery) && (
          <Button type={live ? 'primary' : 'default'} onClick={() => setLive(!live)}>
            {live ? t('Pause live') : t('Resume live')}
          </Button>
        )}
        {mode === 'query' &&
          capabilities.capture &&
          (capture ? (
            <Button onClick={() => setCapture(undefined)}>{t('Back to results')}</Button>
          ) : (
            <>
              <Button disabled={!visible} onClick={() => setCapture({query: {...draft}, follow: false})}>
                {t('Capture')}
              </Button>
              {capabilities.follow && (
                <Button disabled={!visible} onClick={() => setCapture({query: {...draft}, follow: true})}>
                  {t('Listen')}
                </Button>
              )}
            </>
          ))}
        {canPublish && <Button onClick={() => setPublish(!publish)}>{t('Publish')}</Button>}
      </div>
      {publish && canPublish && (
        <CommandMenu conn={conn} paths={[path]} command="publish" desc={capabilities.publish} funcDesc={sourceDesc} />
      )}
      {capture && visible ? (
        <CaptureResults conn={conn} path={path} query={capture.query} follow={capture.follow} />
      ) : (
        <PagedResults
          key={mode + revision}
          conn={conn}
          path={path}
          fetchPage={fetchPage}
          watch={live && capabilities.liveRows && !(mode === 'query' && liveQuery)}
          visible={visible}
          liveQuery={mode === 'query' && liveQuery ? query : undefined}
        />
      )}
    </>
  );
}

export function LiveExplorerDialog({conn, path}: Props) {
  const connected = useConnected(conn);
  const service = useConnectionValue(conn, path + '.#output');
  const status = useConnectionValue<LiveEvent>(conn, path + '.status');
  const [result, setResult] = useState<{service: unknown; capabilities: LiveCapabilities}>();
  const [error, setError] = useState<string>();
  const {ref, visible} = usePanelVisible();
  useEffect(() => {
    setError(undefined);
    setResult(undefined);
    if (!connected || !service) return;
    let active = true;
    conn.getLiveCapabilities(path).then(
      ({capabilities}) => {
        if (active) setResult({service, capabilities});
      },
      (failure) => {
        if (active) setError(String(failure));
      }
    );
    return () => {
      active = false;
    };
  }, [conn, connected, path, service]);
  const ready = connected && service && result?.service === service;
  return (
    <EditPolicyProvider conn={conn}>
      <DockDialogPane error={error}>
        <div ref={ref} className="ticl-e-live">
          {status?.type === 'status' && (
            <div className="ticl-e-live-toolbar">
              {t(status.status)}
              {status.message ? ' · ' + status.message : ''}
            </div>
          )}
          {ready ? (
            <Explorer conn={conn} path={path} capabilities={result.capabilities} visible={visible} />
          ) : (
            <div className="ticl-e-live-empty">{t('Waiting for live source')}</div>
          )}
        </div>
      </DockDialogPane>
    </EditPolicyProvider>
  );
}

export function openLiveExplorerDialog(layout: DockLayout, conn: ClientConn, path: string) {
  createDockDialog(
    layout,
    translateEditor('Manage live data') + ' — ' + path,
    <LiveExplorerDialog conn={conn} path={path} />,
    'live-client-' + path,
    {preferredWidth: 950, preferredHeight: 660}
  );
}
