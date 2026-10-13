import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type {DragState} from 'rc-dock';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import type {DesignerStageContextValue} from './DesignerContext.tsx';
import {findStageDropTarget, getStageChildDrop, type DesignerDropHandlers} from './StageDrop.ts';

export function useStageDrop(
  stageRef: RefObject<HTMLDivElement | null>,
  {designMode, main, elementMap, conn, select}: DesignerStageContextValue,
  activate: () => void,
  handlers: DesignerDropHandlers
) {
  const [dropPoints, setDropPoints] = useState<string | null>(null);
  const clear = useCallback(() => setDropPoints(null), []);
  // rc-dock retains the accepted host's handlers until the drag leaves it.
  const current = useRef({designMode, elementMap, conn, select, activate, handlers});
  current.current = {designMode, elementMap, conn, select, activate, handlers};
  useEffect(() => {
    clear();
  }, [designMode, main, elementMap, conn, clear]);

  const onDragOverT = useCallback(
    (event: DragState) => {
      const {designMode, elementMap, conn, handlers} = current.current;
      if (!designMode) return;
      const stage = stageRef.current;
      const target = findStageDropTarget(stage, elementMap, event.clientX, event.clientY);
      if (handlers.onDragOverT?.(event, target)) {
        if (event.acceptMessage == null) event.accept();
        clear();
        return;
      }
      const drop = getStageChildDrop(stage, elementMap, conn, target, event.clientX, event.clientY);
      if (drop) event.accept('tico-fas-plus');
      setDropPoints(drop?.points ?? null);
    },
    [stageRef, clear]
  );
  const onDropT = useCallback(
    (event: DragState) => {
      const {designMode, elementMap, conn, select, activate, handlers} = current.current;
      clear();
      if (!designMode) return false;
      const stage = stageRef.current;
      const target = findStageDropTarget(stage, elementMap, event.clientX, event.clientY);
      if (handlers.onDropT?.(event, target)) return true;
      const drop = getStageChildDrop(stage, elementMap, conn, target, event.clientX, event.clientY);
      if (!drop) return false;
      activate();
      conn.addBlock(drop.path, drop.data, true, drop.index, {
        ...requestCallbacks,
        onUpdate: ({name}) => {
          const path = drop.block.getFullPath();
          conn.childrenChangeStream().dispatch({path, showNode: true});
          select([`${path}.${name}`]);
        },
      });
      return true;
    },
    [stageRef, clear]
  );
  return {dropPoints, onDragOverT, onDropT, onDragLeaveT: clear};
}
