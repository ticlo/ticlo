import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Block, Flow, type ClientConn} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {useValue} from '@ticlo/react';
import {DesignerPage} from './DesignerPage.tsx';
import {DesignerContext, DesignerStageContext} from './DesignerContext.tsx';

interface Props {
  root: Block;
  conn: ClientConn;
  basePath: string;
}

export function DesignerStage({root, conn, basePath}: Props) {
  const block = useValue(root, basePath);
  const flow = block instanceof Flow ? block : null;
  const [selectedComponents, setSelectedComponents] = useState<Block[]>([]);
  const stage = useMemo(
    () => ({basePath, flow, conn, selectedComponents, setSelectedComponents}),
    [basePath, flow, conn, selectedComponents]
  );
  const registerStage = useContext(DesignerContext)?.registerStage;
  const context = useContext(TicloCurrentFlowContext);
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => {
    setSelectedComponents((previous) => (previous.length ? [] : previous));
  }, [flow]);
  useEffect(() => registerStage?.(stage), [registerStage, stage]);
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
