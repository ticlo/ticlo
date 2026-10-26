import React, {useContext, useState} from 'react';
import {Root, type ClientConn} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '@ticlo/editor';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerNodeTree} from '../DesignerNodeTree.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {TicloCurrentFlowContext, type TicloCurrentFlow} from '@ticlo/editor/component/LayoutContext.ts';

describe('designer tree selection', () => {
  const path = 'DesignerTreeOpen';
  let stage: DesignerStageContextValue;
  let context: TicloCurrentFlow;
  let conn: ClientConn;
  let openFlowStage: () => void;
  let div: HTMLElement;

  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow(path, {
      'calculation': {'#is': 'add', '0': 1, '1': 2},
      '#main': {
        '#is': 'react:div',
        '#order': ['button'],
        'button': {'#is': 'react:button', 'content': 'Click'},
      },
    });
    [, conn] = makeLocalConnection(Root.instance);
    function Panel(): null {
      stage = useActiveDesignerStage();
      context = useContext(TicloCurrentFlowContext);
      return null;
    }
    function FlowStage() {
      const [open, setOpen] = useState(false);
      openFlowStage = () => setOpen(true);
      return open ? (
        <div className="flow" style={{width: 600, height: 300}}>
          <BlockStagePane conn={conn} basePath={path} defaultShowPropertyList={false} />
        </div>
      ) : null;
    }
    [, div] = loadTemplate(
      <DesignerApp value={{}}>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <FlowStage />
        <div className="outline" style={{width: 300, height: 300}}>
          <DesignerNodeTree />
        </div>
        <Panel />
      </DesignerApp>,
      'editor'
    );
    await shouldHappen(() => stage);
    stage.select([`${path}.#main.button`]);
    await shouldHappen(() => row('button'));
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    stage = null;
  });

  function row(name: string) {
    return (
      Array.from(div.querySelectorAll('.outline .ticl-e-tree-node-text')).find((node) => node.textContent === name)
        ?.parentElement ?? null
    );
  }

  it('shares the Outline selection with dataflow stages and restores each stage selection when switching', async () => {
    const designerStage = stage;
    openFlowStage();
    await shouldHappen(() => context.activeStage?.kind === 'dataflow' && div.querySelector('.flow .ticl-e-block'));
    const flowStage = context.activeStage;
    expect(flowStage.conn).toBe(conn);
    const selectedOutline = () =>
      div.querySelector('.outline .ticl-e-tree-node-selected .ticl-e-tree-node-text')?.textContent;
    const selectedBlock = () =>
      div.querySelector('.flow .ticl-e-stage-scroll .ticl-e-block-selected .ticl-e-block-head-label')?.textContent;
    flowStage.select([`${path}.calculation`]);
    await shouldHappen(() => selectedOutline() === 'calculation' && selectedBlock() === 'calculation');
    row('#main').click();
    await shouldHappen(() => selectedBlock() === '#main');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main`]);

    context.activateStage(designerStage.id);
    await shouldHappen(() => context.activeStage?.kind === 'designer' && selectedOutline() === 'button');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main.button`]);
    expect(row('calculation')).toBeNull();

    context.activateStage(flowStage.id);
    await shouldHappen(() => context.activeStage?.kind === 'dataflow' && selectedOutline() === '#main');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main`]);
    expect(row('calculation')).not.toBeNull();
  });
});
