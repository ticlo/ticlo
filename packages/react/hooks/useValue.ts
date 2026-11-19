import {useMemo, useSyncExternalStore} from 'react';
import type {Block} from '@ticlo/core';

/** Read and subscribe to a runtime value at a path relative to a block. */
export function useValue<T = unknown>(block: Block, path: string): T;
export function useValue<T = unknown>(block: Block | null | undefined, path: string | null | undefined): T | undefined;
export function useValue<T = unknown>(block: Block | null | undefined, path: string | null | undefined): T | undefined {
  const store = useMemo(() => {
    if (!block || !path || block._destroyed) {
      return {
        getSnapshot: () => undefined as T | undefined,
        subscribe: () => () => {},
      };
    }
    let value = block.queryValue(path) as T | undefined;
    return {
      getSnapshot: () => value,
      subscribe: (onChange: () => void) => {
        const listener = {
          onChange(next: T) {
            value = next;
            onChange();
          },
          onSourceChange(source: unknown) {
            if (source == null) {
              value = undefined;
              onChange();
            }
          },
        };
        const binding = block.createBinding(path, listener);
        return () => {
          if (!binding.isDestroyed()) binding.unlisten(listener);
        };
      },
    };
  }, [block, path]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
