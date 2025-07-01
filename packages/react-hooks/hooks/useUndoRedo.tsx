import {useCallback, useContext, useMemo} from 'react';
import {FlowContext} from './useFlow';
import {useBlockProps} from './useBlockProps';
import {Values} from '../types/Values';

const BlockStates = {
  '@has-redo': {value: Values.boolean},
  '@has-undo': {value: Values.boolean},
  '@has-change': {value: Values.boolean},
};

export function useUndoRedo() {
  const flow = useContext(FlowContext);

  const undo = useCallback(() => {
    flow?.undo();
  }, [flow]);

  const redo = useCallback(() => {
    flow?.redo();
  }, [flow]);

  const {['@has-redo']: hasRedo, ['@has-undo']: hasUndo, ['@has-change']: hasChange} = useBlockProps(flow, BlockStates);
  return {
    hasRedo,
    hasUndo,
    hasChange,
    undo,
    redo,
  };
}
