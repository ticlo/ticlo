import {ReactNode, useEffect, useMemo, useReducer, useRef} from 'react';
import {Block, BlockIO} from '@ticlo/core';

/**
 * Find children blocks from a block and convert to Record<string, Block>
 * @param block
 * @param filter
 */
export function useFilteredBlocks(block: Block, filter?: (block: Block) => boolean): Record<string, Block> {
  const [, forceUpdate] = useReducer((x) => -x, 1);
  const cache = useRef<Record<string, Block>>(null);
  useEffect(() => {
    const listener = {
      onChildChange: () => {
        cache.current = null;
        forceUpdate();
      },
    };
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block]);

  useMemo(() => {
    // clear the cache when filter changed
    cache.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  if (cache.current) {
    return cache.current;
  }

  // rebuild the cache
  let result: Record<string, Block> = {};
  block.forEach((field: string, value: unknown) => {
    if (value instanceof Block) {
      if (!filter || filter(value)) {
        result[field] = value;
      }
    }
  });
  cache.current = result;
  return result;
}
