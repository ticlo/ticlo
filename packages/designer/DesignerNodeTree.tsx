import React, {useContext} from 'react';
import {BuildOutlined, PlaySquareOutlined} from '@ant-design/icons';
import {NodeTree, type NodeTreeOpenAction} from '@ticlo/editor/node-tree/NodeTree.tsx';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {DesignerLayoutContextType, useActiveDesignerStage} from './DesignerContext.tsx';

function useOpenActions(designFirst: boolean): NodeTreeOpenAction[] {
  const {designFlow, editFlow} = useContext(DesignerLayoutContextType);
  const design = {key: 'design', label: t('Design'), icon: <PlaySquareOutlined />, onOpen: designFlow};
  const flow = {key: 'open-flow', label: t('Open Flow'), icon: <BuildOutlined />, onOpen: editFlow};
  return (designFirst ? [design, flow] : [flow, design]).filter((action) => action.onOpen);
}

export function DesignerNavigationTree(props: React.ComponentProps<typeof NodeTreePane>) {
  const openActions = useOpenActions(true);
  return <NodeTreePane {...props} openActions={openActions} />;
}

export function DesignerNodeTree() {
  const stage = useActiveDesignerStage();
  const openActions = useOpenActions(false);
  return (
    <div className="ticl-d-node-tree" style={{height: '100%'}}>
      {stage?.main ? (
        <NodeTree
          key={`${stage.basePath}:${stage.main._blockId}`}
          conn={stage.conn}
          basePaths={[stage.main.getFullPath()]}
          tags={stage.nodeTreeTags}
          selectedKeys={stage.selection.paths}
          autoExpandSelected
          onSelect={stage.select}
          openActions={openActions}
          style={{height: '100%'}}
        />
      ) : (
        <div className="ticl-d-outline-empty">
          {stage ? 'This stage has no component tree.' : 'No active designer stage.'}
        </div>
      )}
    </div>
  );
}
