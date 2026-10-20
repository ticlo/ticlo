import {useCallback, useContext, useEffect} from 'react';
import {TicloCurrentFlowContext, type TicloStage} from './LayoutContext.ts';

/** Register new snapshots without changing which view owns app commands. */
export function useTicloStage(stage: TicloStage, activateOnMount = true): () => void {
  const {registerStage, unregisterStage, activateStage} = useContext(TicloCurrentFlowContext);
  const {id} = stage;
  useEffect(() => {
    registerStage(stage);
  }, [stage, registerStage]);
  useEffect(() => {
    return () => unregisterStage(id);
  }, [id, unregisterStage]);
  useEffect(() => {
    if (activateOnMount) activateStage(id);
  }, [id, activateOnMount, activateStage]);
  return useCallback(() => activateStage(id), [id, activateStage]);
}
