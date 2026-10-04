import React, {useContext, useEffect, useRef, useState} from 'react';
import {Block, type ClientConn} from '@ticlo/core';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {DesignerPage} from './DesignerPage.tsx';

interface Props {
  root: Block;
  conn: ClientConn;
  basePath: string;
}

export function DesignerStage({root, conn, basePath}: Props) {
  const [block, setBlock] = useState(() => root.queryValue(basePath));
  const context = useContext(TicloCurrentFlowContext);
  const contextRef = useRef(context);
  contextRef.current = context;
  useEffect(() => {
    const listener = {onUpdate: () => setBlock(root.queryValue(basePath))};
    conn.subscribe(basePath, listener);
    return () => conn.unsubscribe(basePath, listener);
  }, [root, conn, basePath]);
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
      {block instanceof Block ? (
        <DesignerPage block={block} key={block._blockId} />
      ) : (
        <div style={{padding: 24}}>This flow is not available.</div>
      )}
    </div>
  );
}
