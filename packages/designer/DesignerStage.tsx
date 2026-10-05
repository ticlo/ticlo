import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Block, Flow, type ClientConn} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {ComponentContext, useValue, type ComponentContextValue} from '@ticlo/react';
import {DesignerPage} from './DesignerPage.tsx';
import type {DesignerStageContextValue} from './DesignerContext.tsx';
import {useSelection} from './useSelection.ts';

interface Props {
  root: Block;
  conn: ClientConn;
  basePath: string;
}

export function DesignerStage({root, conn, basePath}: Props) {
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
  const [designMode, setDesignMode] = useState(true);
  const componentContext = useMemo<ComponentContextValue<Block | string>>(
    () => ({designMode, select, addSelection}),
    [designMode, select, addSelection]
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
    [basePath, flow, main, conn, selection, componentContext, historyCommands]
  );
  const context = useContext(TicloCurrentFlowContext);
  const {registerStage, unregisterStage} = context;
  const contextRef = useRef(context);
  contextRef.current = context;
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
      className="ticl-designer-stage"
      style={{height: '100%'}}
      onPointerDownCapture={() => context.onFlowFocus(basePath)}
    >
      <ComponentContext.Provider value={componentContext}>
        {flow ? (
          <DesignerPage flow={flow} key={flow._blockId} />
        ) : (
          <div style={{padding: 24}}>This flow is not available.</div>
        )}
      </ComponentContext.Provider>
    </div>
  );
}
