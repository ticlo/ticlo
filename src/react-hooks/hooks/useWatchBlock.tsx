import {useEffect, useReducer} from 'react';
import {Block} from '@ticlo/core';

/**
 * Rerender when any IO property in the block is changed
 * @param block
 */
export function useWatchBlock(block: Block): void {
  const [, forceUpdate] = useReducer((x) => -x, 1);

  useEffect(() => {
    const listener = {onChildChange: forceUpdate};
    block.watch(listener);
    return () => {
      block.unwatch(listener);
    };
  }, [block]);
}
