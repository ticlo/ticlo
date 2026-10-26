import React, {useContext} from 'react';
import {BuildOutlined, PlaySquareOutlined} from '@ant-design/icons';
import {NodeTree, type NodeTreeOpenAction} from '@ticlo/editor/node-tree/NodeTree.tsx';
import {NodeTreePane} from '@ticlo/editor/dock/node-tree/NodeTreePane.tsx';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {DesignerLayoutContextType, useActiveDesignerStage} from './DesignerContext.tsx';

function useOpenActions(designFirst = false): NodeTreeOpenAction[] {
  const {designFlow, editFlow} = useContext(DesignerLayoutContextType);
  const design = {
    key: 'design',
    label: t('Design'),
    icon: <PlaySquareOutlined />,
    onOpen: designFlow,
    functionIds: ['flow:main', 'flow:worker'],
  };
  const flow = {key: 'open-flow', label: t('Open Flow'), icon: <BuildOutlined />, onOpen: editFlow};
  return (designFirst ? [design, flow] : [flow, design]).filter((action) => action.onOpen);
}

export function DesignerNavigationTree(props: React.ComponentProps<typeof NodeTreePane>) {
  const openActions = useOpenActions(true);
  return <NodeTreePane {...props} openActions={openActions} />;
}

export function DesignerNodeTree() {
  const {activeStage: stage} = useContext(TicloCurrentFlowContext);
  const designerStage = useActiveDesignerStage();
  const basePath = designerStage ? designerStage.main?.getFullPath() : stage?.basePath;
  const openActions = useOpenActions();
  return (
    <div className="ticl-d-node-tree" style={{height: '100%'}}>
      {stage?.conn && basePath != null ? (
        <NodeTree
          key={`${stage.id}:${designerStage?.main?._blockId ?? ''}`}
          conn={stage.conn}
          basePaths={[basePath]}
          tags={stage.nodeTreeTags}
          selectedKeys={stage.selection.paths}
          autoExpandSelected
          onSelect={stage.select}
          openActions={openActions}
          style={{height: '100%'}}
        />
      ) : (
        <div className="ticl-d-outline-empty">{stage ? 'This stage has no component tree.' : 'No active stage.'}</div>
      )}
    </div>
  );
}
