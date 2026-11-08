import {useMemo, useSyncExternalStore} from 'react';
import {Block, type BlockProperty} from '@ticlo/core';

/** Subscribe to the matching child Blocks, retaining unchanged snapshots. */
export function useFilteredBlocks(block: Block, filter?: (block: Block) => boolean): Record<string, Block> {
  const store = useMemo(() => {
    const read = () => {
      const result: Record<string, Block> = {};
      block.forEach((field, value) => {
        if (value instanceof Block && (!filter || filter(value))) result[field] = value;
      });
      return result;
    };
    let snapshot = read();
    return {
      getSnapshot: () => snapshot,
      subscribe: (onChange: () => void) => {
        const listener = {
          onChildChange(property?: BlockProperty) {
            if (property && !(property.getValue() instanceof Block) && !Object.hasOwn(snapshot, property._name)) return;
            const next = read();
            const fields = Object.keys(next);
            if (
              fields.length === Object.keys(snapshot).length &&
              fields.every((field) => next[field] === snapshot[field])
            )
              return;
            snapshot = next;
            onChange();
          },
        };
        block.watch(listener);
        listener.onChildChange();
        return () => block.unwatch(listener);
      },
    };
  }, [block, filter]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
