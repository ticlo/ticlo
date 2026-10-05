import React, {useContext, useEffect, useMemo, useRef} from 'react';
import {Block, Flow, type ClientConn} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {useValue} from '@ticlo/react';
import {DesignerPage} from './DesignerPage.tsx';
import {DesignerStageContext, type DesignerStageContextValue} from './DesignerContext.tsx';
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
  const {selection, select} = useSelection(root, main);
  const stage = useMemo<DesignerStageContextValue>(
    () => ({kind: 'designer', basePath, flow, main, conn, selection, select}),
    [basePath, flow, main, conn, selection, select]
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
    <DesignerStageContext.Provider value={stage}>
      <div
        className="ticl-designer-stage"
        style={{height: '100%'}}
        onPointerDownCapture={() => context.onFlowFocus(basePath)}
      >
        {flow ? (
          <DesignerPage flow={flow} key={flow._blockId} />
        ) : (
          <div style={{padding: 24}}>This flow is not available.</div>
        )}
      </div>
    </DesignerStageContext.Provider>
  );
}
