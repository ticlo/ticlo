import {useMemo, useSyncExternalStore} from 'react';
import type {Block} from '@ticlo/core';

/** Read and subscribe to a runtime value at a path relative to a block. */
export function useValue<T = unknown>(block: Block, path: string): T {
  const store = useMemo(() => {
    let value = block.queryValue(path) as T;
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
              value = undefined as T;
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
