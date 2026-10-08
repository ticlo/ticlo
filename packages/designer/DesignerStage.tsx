import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Block, Flow, voidFunction, type ClientConn} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {ComponentContext, ElementMap, useValue} from '@ticlo/react';
import {DesignerPage} from './DesignerPage.tsx';
import {DesignerSelectionLayer} from './DesignerSelectionLayer.tsx';
import {DesignerLayoutContextType, type DesignerStageContextValue} from './DesignerContext.tsx';
import {useSelection} from './useSelection.ts';
import {useStageInput} from './useStageInput.ts';

interface Props {
  root: Block;
  conn: ClientConn;
  basePath: string;
}

export function DesignerStage({root, conn, basePath}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [elementMap] = useState(() => new ElementMap());
  const block = useValue(root, basePath);
  const flow = block instanceof Flow ? block : null;
  const value = useValue(root, `${basePath}.#main`);
  const main = flow && value instanceof Block ? value : null;
  useEffect(() => {
    if (!flow) return;
    const watcher = {watchHistory: true, onChildChange() {}};
    flow.watch(watcher);
    return () => flow.unwatch(watcher);
  }, [flow]);
  const {selection, select, addSelection} = useSelection(root, main);
  const {designMode = true, setDesignMode = voidFunction} = useContext(DesignerLayoutContextType);
  const componentContext = useMemo(
    () => ({designMode, elementMap, select, addSelection}),
    [designMode, elementMap, select, addSelection]
  );
  const historyCommands = useMemo(
    () => ({
      undo: () => {
        if (!flow) return false;
        conn.undo(basePath, requestCallbacks);
        return true;
      },
      redo: () => {
        if (!flow) return false;
        conn.redo(basePath, requestCallbacks);
        return true;
      },
    }),
    [flow, conn, basePath]
  );
  const stage = useMemo<DesignerStageContextValue>(
    () => ({
      kind: 'designer',
      basePath,
      flow,
      main,
      conn,
      selection,
      ...componentContext,
      setDesignMode,
      ...historyCommands,
    }),
    [basePath, flow, main, conn, selection, componentContext, setDesignMode, historyCommands]
  );
  const context = useContext(TicloCurrentFlowContext);
  const {registerStage, unregisterStage} = context;
  const contextRef = useRef(context);
  contextRef.current = context;
  const activate = useCallback(() => contextRef.current.onFlowFocus(basePath), [basePath]);
  const hover = useStageInput(stageRef, componentContext, activate);
  useEffect(() => {
    registerStage(basePath, stage);
    return () => unregisterStage(basePath, stage);
  }, [basePath, registerStage, unregisterStage, stage]);
  useEffect(() => {
    contextRef.current.onFlowFocus(basePath);
    return () => contextRef.current.onFlowClosed(basePath);
  }, [basePath]);
  return (
    <div
      className={designMode ? 'ticl-d-stage ticl-d-stage-design' : 'ticl-d-stage'}
      ref={stageRef}
      tabIndex={designMode ? 0 : undefined}
      onPointerDownCapture={activate}
    >
      <ComponentContext.Provider value={componentContext}>
        {flow ? (
          <DesignerPage flow={flow} key={flow._blockId} />
        ) : (
          <div className="ticl-d-empty">This flow is not available.</div>
        )}
      </ComponentContext.Provider>
      {flow && designMode && (
        <DesignerSelectionLayer stageRef={stageRef} elementMap={elementMap} blocks={selection.blocks} hover={hover} />
      )}
    </div>
  );
}
