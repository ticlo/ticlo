import {useMemo, useSyncExternalStore} from 'react';
import {ClientConn, ValueSubscriber} from '@ticlo/core/editor.ts';
import {batchUpdateReact} from '../util/BatchUpdate.ts';

// A value-only snapshot: binding and listener metadata do not invalidate it.
// Construction is side-effect free; React owns the subscription lifetime.
export class ConnectionValueStore<T = any> {
  private value: T;
  private listeners = new Set<() => void>();
  private subscriber = new ValueSubscriber({
    onUpdate: ({cache}) => {
      const value = this.select ? this.select(cache.value) : cache.value;
      if (!Object.is(value, this.value)) {
        this.value = value;
        batchUpdateReact(this.notify, this.conn);
      }
    },
  });

  constructor(
    private conn: ClientConn,
    private path: string,
    private select?: (value: any) => T
  ) {
    this.value = select?.(undefined);
  }

  // Connection values are replaced on update. Keep their identity between updates.
  getSnapshot = () => this.value;

  private notify = () => {
    for (const listener of this.listeners) {
      listener();
    }
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.subscriber.subscribe(this.conn, this.path);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.subscriber.unsubscribe();
      }
    };
  };
}

export function useConnectionValue<T = any>(conn: ClientConn, path: string, select?: (value: any) => T) {
  const store = useMemo(() => new ConnectionValueStore(conn, path, select), [conn, path, select]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
