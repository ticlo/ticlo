import React, {useContext} from 'react';
import {vi} from 'vitest';
import {DockLayout} from 'rc-dock';
import {Block, Root, type Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {initEditor} from '../../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {BlockStagePane} from '../BlockStagePane.tsx';
import {TicloApp} from '../../../component/TicloApp.tsx';
import {TicloCurrentFlowContext, type TicloCurrentFlow} from '../../../component/LayoutContext.ts';
import {StagePanelFocus} from '../../StagePanelFocus.tsx';

describe('BlockStagePane', () => {
  const flowPath = 'BlockStagePaneReload';

  beforeEach(async () => {
    await initEditor();
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(flowPath);
  });

  it('activates individual dock tabs, including cached tabs and tabs without save callbacks', async () => {
    Root.instance.addFlow(flowPath, {add: {'#is': 'add'}, second: {'#is': ''}, third: {'#is': ''}});
    const [, conn] = makeLocalConnection(Root.instance);
    const saveSecond = vi.fn();
    const saveThird = vi.fn();
    const first = BlockStagePane.createDockTab(flowPath, conn);
    const second = BlockStagePane.createDockTab(`${flowPath}.second`, conn, undefined, saveSecond);
    const third = BlockStagePane.createDockTab(`${flowPath}.third`, conn, undefined, saveThird);
    let context: TicloCurrentFlow;
    let layout: DockLayout;
    function Panel(): null {
      context = useContext(TicloCurrentFlowContext);
      return null;
    }
    const [, div] = loadTemplate(
      <TicloApp value={{}}>
        <DockLayout
          ref={(value) => {
            layout = value;
          }}
          groups={{blockStage: {panelExtra: (panel) => <StagePanelFocus panel={panel} />}}}
          defaultLayout={{
            dockbox: {mode: 'horizontal', children: [{tabs: [first]}, {tabs: [second, third], activeId: second.id}]},
          }}
          style={{width: 1000, height: 500}}
        />
        <Panel />
      </TicloApp>,
      'editor'
    );
    await shouldHappen(() => div.querySelectorAll('.ticl-e-stage').length === 3);
    expect(context.activeStage?.id).toBe(second.id);
    // Clicking a tab in a different panel must activate it even though panel.activeId does not change.
    div.querySelector<HTMLElement>('.ticl-e-stage-panel-tab').click();
    await shouldHappen(() => context.activeStage.id === first.id);
    expect(context.runStageCommand('save')).toBe(false);
    layout.updateTab(third.id, null, true);
    await shouldHappen(() => context.activeStage.id === third.id);
    context.runStageCommand('save');
    expect(saveThird).toHaveBeenCalledTimes(1);
    const stageCount = div.querySelectorAll('.ticl-e-stage').length;
    const firstPane = div.querySelector<HTMLElement>('.ticl-e-stage-tab-content');
    firstPane.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    firstPane.focus();
    expect(context.activeStage.id).toBe(third.id);
    context.runStageCommand('save');
    expect(saveThird).toHaveBeenCalledTimes(2);
    firstPane.dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await shouldHappen(() => context.activeStage.id === first.id);
    layout.updateTab(second.id, null, true);
    await shouldHappen(() => context.activeStage.id === second.id);
    expect(div.querySelectorAll('.ticl-e-stage').length).toBe(stageCount);
    expect(div.querySelectorAll('.ticl-e-selected-stage').length).toBe(1);
    context.runStageCommand('save');
    expect(saveSecond).toHaveBeenCalledTimes(1);
    expect(context.currentPath).toBe(`${flowPath}.second`);

    const close = div.querySelector<HTMLElement>(`[data-node-key="${second.id}"] .dock-tab-close-btn`);
    expect(close.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(close.getBoundingClientRect().height).toBeGreaterThan(0);
    close.click();
    await shouldHappen(() => layout.find(second.id) === undefined);
    expect(layout.find(first.id)).toBeDefined();
    expect(layout.find(third.id)).toBeDefined();
  });

  it.each([true, false])('reloads a runtime worker after consecutive saves (serialize=%s)', async (serialize) => {
    const flow = Root.instance.addFlow(flowPath);
    const child = {'#is': 'add', '0': 1, '1': 2, '@b-p': ['0', '1', '#output']};
    WorkerFunctionGen.registerType({'#is': '', 'add': child}, {id: ':fn', name: 'fn'}, undefined, flow.getFuncLib());
    flow.createBlock('fn').setValue('#is', ':fn');
    Root.run();
    const workerPath = `${flowPath}.fn.#worker`;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, serialize);
    let pane: BlockStagePane;
    const [, div] = loadTemplate(
      <BlockStagePane
        ref={(value) => {
          pane = value;
        }}
        conn={conn}
        basePath={workerPath}
      />,
      'editor'
    );
    const findBlock = (name: string) =>
      [...div.querySelectorAll('.ticl-e-block')].find(
        (block) => block.querySelector('.ticl-e-block-head-label')?.textContent.trim() === name
      );
    await shouldHappen(() => findBlock('add'));

    for (const [index, name] of ['first', 'second'].entries()) {
      const worker = Root.instance.queryValue(workerPath) as Flow;
      const stage = div.querySelector('.ticl-e-stage');
      await conn.addBlock(`${workerPath}.${name}`, child);
      await shouldHappen(() => findBlock(name));
      pane.onSelect([`${workerPath}.${name}`]);
      await shouldHappen(() => pane.state.selectedKeys.length === 1);
      await conn.applyFlowChange(workerPath);
      Root.run();

      const reloaded = Root.instance.queryValue(workerPath) as Flow;
      expect(reloaded).not.toBe(worker);
      expect(reloaded.getValue(name)).toBeInstanceOf(Block);
      await shouldHappen(
        () => {
          const nextStage = div.querySelector('.ticl-e-stage');
          return nextStage && nextStage !== stage;
        },
        1000,
        'stage reloads after save'
      );
      await shouldHappen(() => findBlock('add') && findBlock(name));
      expect(pane.state.selectedKeys).toEqual([]);

      await conn.setValue(`${workerPath}.${name}.0`, 10 + index, true);
      await shouldHappen(() =>
        [...(findBlock(name)?.querySelectorAll('.ticl-e-field-value') ?? [])].some(
          (field) => field.textContent === String(12 + index)
        )
      );
    }
  });
});
