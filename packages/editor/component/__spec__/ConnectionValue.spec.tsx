import React, {StrictMode, Suspense} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {vi} from 'vitest';
import type {ClientConn, ValueState} from '@ticlo/core/editor.ts';
import type {SubscribeCallbacks} from '@ticlo/core/connect/ClientRequests.ts';
import {ConnectionValueStore, useConnectionValue} from '../useConnectionValue.ts';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../LazyUpdateComponent.tsx';
import {FieldValue} from '../../block/FieldValue.tsx';
import {TicloLayoutContextType} from '../LayoutContext.ts';

function createConnection() {
  const subscriptions = new Map<SubscribeCallbacks, string>();
  const cache = new Map<string, ValueState>();
  const pending = new Set<() => void>();
  let batching = false;
  const conn = {
    subscribe: vi.fn((path: string, callback: SubscribeCallbacks) => {
      subscriptions.set(callback, path);
      if (cache.has(path)) callback.onUpdate({cache: cache.get(path)});
    }),
    unsubscribe: vi.fn((_path: string, callback: SubscribeCallbacks) => {
      subscriptions.delete(callback);
    }),
    callImmediate(callback: () => void) {
      if (batching) pending.add(callback);
      else callback();
    },
    getBaseConn() {
      return conn;
    },
  } as unknown as ClientConn;

  function update(path: string, change: ValueState) {
    const state = {...cache.get(path), ...change};
    cache.set(path, state);
    for (const [callback, subscribedPath] of subscriptions) {
      if (path === subscribedPath) callback.onUpdate({cache: state, change});
    }
  }

  function batch(callback: () => void) {
    batching = true;
    try {
      callback();
    } finally {
      batching = false;
      for (const callback of pending) callback();
      pending.clear();
    }
  }

  return {conn, subscriptions, update, batch};
}

describe('connection value subscriptions', () => {
  let root: Root;
  let div: HTMLDivElement;

  beforeEach(() => {
    div = document.createElement('div');
    document.body.appendChild(div);
    root = createRoot(div);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    div.remove();
  });

  it('keeps snapshots stable and shares a subscription until the last listener leaves', () => {
    const {conn, subscriptions, update, batch} = createConnection();
    const value = {number: 1};
    update('field', {value});
    const store = new ConnectionValueStore(conn, 'field');
    expect(subscriptions.size).toBe(0);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = store.subscribe(first);
    const stopSecond = store.subscribe(second);
    expect(conn.subscribe).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(value);

    first.mockClear();
    update('field', {bindingPath: 'source', hasListener: true});
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(value);

    batch(() => {
      update('field', {value: 2});
      update('field', {value: 3});
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(3);
    stopFirst();
    expect(subscriptions.size).toBe(1);
    batch(() => {
      update('field', {value: 4});
      stopSecond();
    });
    expect(subscriptions.size).toBe(0);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('matches class render counts for value updates and skips binding-only changes', () => {
    const {conn, subscriptions, update, batch} = createConnection();
    update('field', {value: 0});
    let classRenders = 0;
    let hookRenders = 0;
    class ClassValue extends LazyUpdateComponent<{conn: ClientConn}, any> {
      subscriber = new LazyUpdateSubscriber(this);
      constructor(props: {conn: ClientConn}) {
        super(props);
        this.subscriber.subscribe(props.conn, 'field');
      }
      renderImpl() {
        ++classRenders;
        return <span>{this.subscriber.value}</span>;
      }
      componentWillUnmount() {
        this.subscriber.unsubscribe();
        super.componentWillUnmount();
      }
    }
    const HookValue = React.memo(function HookValue() {
      const value = useConnectionValue(conn, 'field');
      ++hookRenders;
      return <span>{value}</span>;
    });
    const render = () => (
      <>
        <ClassValue conn={conn} />
        <HookValue />
      </>
    );
    flushSync(() => root.render(render()));
    expect(div.textContent).toBe('00');
    // The hook subscribes after commit and needs one extra render for cached data.
    expect([classRenders, hookRenders]).toEqual([1, 2]);
    classRenders = hookRenders = 0;

    flushSync(() => {
      root.render(render());
      batch(() => {
        for (let i = 0; i < 100; ++i) update('field', {value: 0});
        update('other', {value: 1});
      });
    });
    expect([classRenders, hookRenders]).toEqual([0, 0]);

    flushSync(() =>
      batch(() => {
        for (let i = 1; i <= 100; ++i) update('field', {value: i});
      })
    );
    expect([classRenders, hookRenders]).toEqual([1, 1]);
    expect(div.textContent).toBe('100100');
    classRenders = hookRenders = 0;

    flushSync(() => update('field', {bindingPath: 'source'}));
    expect([classRenders, hookRenders]).toEqual([1, 0]);
    flushSync(() => root.render(null));
    expect(subscriptions.size).toBe(0);
  });

  it('reconnects after StrictMode cleanup and follows path and connection changes', () => {
    const first = createConnection();
    const second = createConnection();
    first.update('a', {value: 1});
    first.update('b', {value: 2});
    second.update('b', {value: 3});
    const render = (conn: ClientConn, path: string) => {
      flushSync(() =>
        root.render(
          <StrictMode>
            <FieldValue conn={conn} path={path} />
          </StrictMode>
        )
      );
    };

    render(first.conn, 'a');
    expect(first.subscriptions.size).toBe(1);
    expect(div.textContent).toBe('1');
    flushSync(() => first.update('a', {value: 4}));
    expect(div.textContent).toBe('4');
    render(first.conn, 'b');
    expect([...first.subscriptions.values()]).toEqual(['b']);
    expect(div.textContent).toBe('2');
    flushSync(() => first.update('a', {value: 9}));
    expect(div.textContent).toBe('2');
    render(second.conn, 'b');
    expect(first.subscriptions.size).toBe(0);
    expect(second.subscriptions.size).toBe(1);
    expect(div.textContent).toBe('3');
    flushSync(() => root.render(null));
    expect(second.subscriptions.size).toBe(0);
  });

  it('does not subscribe when a render suspends before committing', () => {
    const {conn, subscriptions} = createConnection();
    const pending = new Promise(() => {});
    function SuspendedValue(): React.ReactNode {
      useConnectionValue(conn, 'field');
      throw pending;
    }
    flushSync(() =>
      root.render(
        <Suspense fallback="loading">
          <SuspendedValue />
        </Suspense>
      )
    );
    expect(div.textContent).toBe('loading');
    expect(subscriptions.size).toBe(0);
  });

  it('keeps object-tree ownership stable and closes it on path changes and unmount', () => {
    const {conn, update} = createConnection();
    const showObjectTree = vi.fn();
    const closeObjectTree = vi.fn();
    const context = {showObjectTree, closeObjectTree};
    const value = {number: 1};
    update('field', {value});
    update('other', {value});
    const render = (path: string, language = 'en') => {
      flushSync(() =>
        root.render(
          <TicloLayoutContextType.Provider value={{...context, language}}>
            <FieldValue conn={conn} path={path} />
          </TicloLayoutContextType.Provider>
        )
      );
    };
    render('field');
    const arrow = div.querySelector('.ticl-tree-arr');
    flushSync(() => arrow.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})));
    expect(showObjectTree).toHaveBeenCalledTimes(1);
    const source = showObjectTree.mock.calls[0][3];
    expect(showObjectTree).toHaveBeenCalledWith('field', value, arrow, source);
    render('field', 'fr');
    expect(closeObjectTree).not.toHaveBeenCalled();
    flushSync(() => update('field', {value: {number: 2}}));
    flushSync(() => div.querySelector('.ticl-tree-arr').dispatchEvent(new MouseEvent('dblclick', {bubbles: true})));
    expect(showObjectTree.mock.calls[1][3]).toBe(source);
    render('other');
    expect(closeObjectTree).toHaveBeenCalledExactlyOnceWith('field', source);
    flushSync(() => div.querySelector('.ticl-tree-arr').dispatchEvent(new MouseEvent('dblclick', {bubbles: true})));
    flushSync(() => root.render(null));
    expect(closeObjectTree.mock.calls).toEqual([
      ['field', source],
      ['other', source],
    ]);
  });
});
