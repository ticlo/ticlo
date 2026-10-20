import {useContext, useEffect} from 'react';
import type {PanelData} from 'rc-dock';
import {TicloCurrentFlowContext} from '../component/LayoutContext.ts';

/** Restore the active view when switching to an already mounted dock tab. */
export function StagePanelFocus({panel}: {panel: PanelData}): null {
  const {activateStage} = useContext(TicloCurrentFlowContext);
  const id = panel.activeId;
  useEffect(() => {
    if (id) activateStage(id);
  }, [id, activateStage]);
  return null;
}
