import {useMemo, useSyncExternalStore} from 'react';
import {Block} from '@ticlo/core';

export function useBlockValue<T = unknown>(block: Block, name: string): T;
export function useBlockValue<T = unknown>(block: Block | null | undefined, name: string): T | undefined;
export function useBlockValue<T = unknown>(block: Block | null | undefined, name: string): T | undefined {
  const store = useMemo(
    () => ({
      getSnapshot: () => (block && !block._destroyed ? (block.getValue(name) as T) : undefined),
      subscribe: (onChange: () => void) => {
        if (!block || block._destroyed) return () => {};
        const property = block.getProperty(name, true);
        const listener = {onChange};
        property.listen(listener);
        return () => property.unlisten(listener);
      },
    }),
    [block, name]
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
