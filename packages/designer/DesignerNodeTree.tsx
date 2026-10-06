import React from 'react';
import {NodeTree} from '@ticlo/editor/node-tree/NodeTree.tsx';
import {useActiveDesignerStage} from './DesignerContext.tsx';

export function DesignerNodeTree() {
  const stage = useActiveDesignerStage();
  return (
    <div className="ticl-designer-node-tree">
      {stage?.main ? (
        <NodeTree
          key={`${stage.basePath}:${stage.main._blockId}`}
          conn={stage.conn}
          basePaths={[stage.main.getFullPath()]}
          selectedKeys={stage.selection.paths}
          onSelect={stage.select}
          style={{height: '100%'}}
        />
      ) : (
        <div className="ticl-designer-outline-empty">
          {stage ? 'This stage has no component tree.' : 'No active designer stage.'}
        </div>
      )}
    </div>
  );
}
