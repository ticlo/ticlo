import {useCallback, type MouseEvent} from 'react';
import type {Block} from '@ticlo/core';
import type {ComponentContextValue} from '../ComponentContext.ts';

/** A component's mousedown selection handler, available only in design mode. */
export function useSelection(block: Block, {designMode, select, addSelection}: ComponentContextValue<Block | string>) {
  const onMouseDown = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      return event.ctrlKey ? addSelection([block]) : select([block]);
    },
    [block, select, addSelection]
  );
  return designMode ? onMouseDown : undefined;
}
