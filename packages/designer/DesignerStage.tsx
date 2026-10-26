import React, {isValidElement, useContext, useEffect, useId, useMemo, useRef, useState} from 'react';
import {Block, Flow, voidFunction, type ClientConn, type DataMap} from '@ticlo/core';
import {FlowWithStatic} from '@ticlo/core/block/StaticBlock.ts';
import {Button} from 'antd';
import {useEditPolicy} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {useTicloStage} from '@ticlo/editor/component/useTicloStage.ts';
import {requestCallbacks} from '@ticlo/editor/util/RequestCallbacks.ts';
import {ElementMap, TicloPage, revealChild, useValue} from '@ticlo/react';
import {DesignerSelectionLayer} from './DesignerSelectionLayer.tsx';
import {DesignerLayoutContextType, type DesignerStageContextValue} from './DesignerContext.tsx';
import {useSelection} from './useSelection.ts';
import {useStageInput} from './useStageInput.ts';
import {DragDrop} from 'rc-dock';
import {useStageDrop} from './useStageDrop.ts';
import type {DesignerDropHandlers} from './StageDrop.ts';
import {useStageCommands} from './useStageCommands.ts';

const defaultFunctionTreeTags = ['react-comp'];
const defaultNodeTreeTags = ['react-comp'];
const pageLayouts: {label: string; data: DataMap}[] = [
  {label: 'Absolute', data: {'#is': 'react:absolute', '#order': []}},
  {label: 'Horizontal', data: {'#is': 'react:horizontal', '#order': []}},
  {label: 'Vertical', data: {'#is': 'react:vertical', '#order': []}},
];

interface Props extends DesignerDropHandlers {
  root: Block;
  conn: ClientConn;
  basePath: string;
  stageId?: string;
  onSave?: () => void;
  functionTreeTags?: readonly string[];
  nodeTreeTags?: readonly string[];
}

export function DesignerStage({
  root,
  conn,
  basePath,
  stageId,
  onSave,
  onDragOverT,
  onDropT,
  functionTreeTags = defaultFunctionTreeTags,
  nodeTreeTags = defaultNodeTreeTags,
}: Props) {
  const generatedId = useId();
  const id = stageId ?? generatedId;
  const stageRef = useRef<HTMLDivElement>(null);
  const [elementMap] = useState(() => new ElementMap());
  const block = useValue(root, basePath);
  const flow = block instanceof Flow ? block : null;
  const value = useValue(root, `${basePath}.#main`);
  const main = flow && value instanceof Block ? value : null;
  const hasPage = main !== null || isValidElement(value);
  const policy = useEditPolicy();
  useEffect(() => {
    if (!flow) return;
    const watcher = {watchHistory: true, onChildChange() {}};
    flow.watch(watcher);
    return () => flow.unwatch(watcher);
  }, [flow]);
  const {selection, selectionRef, select, addSelection} = useSelection(root, main);
  const {designMode = true, setDesignMode = voidFunction} = useContext(DesignerLayoutContextType);
  useEffect(() => {
    if (!designMode) return;
    const ancestors: [Block, Block][] = [];
    for (let child = selection.blocks.at(-1); child && child !== main;) {
      const parent = child.getParent();
      if (!parent) break;
      ancestors.push([parent, child]);
      child = parent;
    }
    for (const [parent, child] of ancestors.reverse()) revealChild(parent, child);
  }, [designMode, main, selection]);
  const componentContext = useMemo(
    () => ({designMode, elementMap, select, addSelection}),
    [designMode, elementMap, select, addSelection]
  );
  const commands = useStageCommands({conn, basePath, flow, main, designMode, select}, selectionRef, onSave);
  const stage = useMemo<DesignerStageContextValue>(
    () => ({
      id,
      kind: 'designer',
      functionTreeTags,
      nodeTreeTags,
      basePath,
      flow,
      main,
      conn,
      selection,
      ...componentContext,
      setDesignMode,
      ...commands,
    }),
    [
      id,
      basePath,
      flow,
      main,
      conn,
      selection,
      componentContext,
      setDesignMode,
      commands,
      functionTreeTags,
      nodeTreeTags,
    ]
  );
  const activate = useTicloStage(stage, stageId == null);
  const {hover, marquee, resizePreview, startResize} = useStageInput(
    stageRef,
    {...componentContext, designMode: designMode && hasPage},
    selectionRef,
    flow
  );
  const {dropPoints, ...dropHandlers} = useStageDrop(stageRef, stage, activate, {onDragOverT, onDropT});
  const canCreatePage = (data: DataMap) =>
    flow &&
    !flow.isDestroyed() &&
    flow.getValue('#main') == null &&
    [policy, conn.getEditPolicyView()].every((view) => view.can({cmd: 'addBlock', path: `${basePath}.#main`, data}));
  const createPage = (data: DataMap) => {
    if (!designMode || !canCreatePage(data)) return;
    activate();
    conn.addBlock(`${basePath}.#main`, data, false, undefined, requestCallbacks);
  };
  return (
    <DragDrop
      className={designMode ? 'ticl-d-stage ticl-d-stage-design' : 'ticl-d-stage'}
      ref={stageRef}
      tabIndex={designMode ? 0 : undefined}
      onPointerUpCapture={activate}
      {...dropHandlers}
    >
      {flow ? (
        <div className={flow instanceof FlowWithStatic ? 'ticl-d-page ticl-d-page-worker' : 'ticl-d-page'}>
          {designMode && hasPage && <div className="ticl-d-input-layer" />}
          <TicloPage
            block={flow}
            key={flow._blockId}
            context={componentContext}
            fallback={
              <div className="ticl-d-empty ticl-d-page-setup">
                <h3>This flow has no page yet.</h3>
                {designMode && (
                  <>
                    <p>Choose a layout to start designing.</p>
                    <div className="ticl-d-layout-options">
                      {pageLayouts.map(({label, data}) => (
                        <Button key={label} disabled={!canCreatePage(data)} onClick={() => createPage(data)}>
                          {label}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <div className="ticl-d-empty">This flow is not available.</div>
      )}
      {flow && designMode && (
        <DesignerSelectionLayer
          stageRef={stageRef}
          elementMap={elementMap}
          main={main}
          blocks={selection.blocks}
          hover={hover}
          marquee={marquee}
          dropPoints={dropPoints}
          resizePreview={resizePreview}
          onResizeStart={startResize}
        />
      )}
    </DragDrop>
  );
}
