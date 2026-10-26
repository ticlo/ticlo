import React, {useContext, useState} from 'react';
import {flushSync} from 'react-dom';
import {vi, type Mock} from 'vitest';
import {Root, PropDispatcher, type ClientConn, type Flow} from '@ticlo/core';
import {WorkerFlow} from '@ticlo/core/worker/WorkerFlow.ts';
import {FlowEditor} from '@ticlo/core/worker/FlowEditor.ts';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '@ticlo/editor';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerNavigationTree, DesignerNodeTree} from '../DesignerNodeTree.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';
import {BlockStagePane} from '@ticlo/editor/dock/block/BlockStagePane.tsx';
import {TicloCurrentFlowContext, type TicloCurrentFlow} from '@ticlo/editor/component/LayoutContext.ts';

describe('designer tree open actions', () => {
  const path = 'DesignerTreeOpen';
  let designFlow: Mock<(path: string, onSave: () => void) => void>;
  let editFlow: Mock<(path: string, onSave: () => void) => void>;
  let stage: DesignerStageContextValue;
  let context: TicloCurrentFlow;
  let conn: ClientConn;
  let openFlowStage: () => void;
  let div: HTMLElement;

  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow(
      path,
      {
        'calculation': {'#is': 'add', '0': 1, '1': 2},
        '#main': {
          '#is': 'react:div',
          '#order': ['button'],
          'button': {'#is': 'react:button', 'content': 'Click'},
        },
      },
      {applyChange: (flow) => flow.save()}
    );
    [, conn] = makeLocalConnection(Root.instance);
    designFlow = vi.fn();
    editFlow = vi.fn();
    const selection = new PropDispatcher<string[]>();
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
      <DesignerApp value={{designFlow, editFlow, getSelectedPaths: () => selection}}>
        <div className="navigation" style={{width: 300, height: 300}}>
          <DesignerNavigationTree conn={conn} basePaths={[path]} />
        </div>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <FlowStage />
        <div className="outline" style={{width: 300, height: 300}}>
          <DesignerNodeTree />
        </div>
        <Panel />
      </DesignerApp>,
      'editor'
    );
    await shouldHappen(() => stage && row('navigation', path));
    stage.select([`${path}.#main.button`]);
    await shouldHappen(() => row('outline', 'button'));
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    stage = null;
  });

  function row(tree: string, name: string) {
    return (
      Array.from(div.querySelectorAll(`.${tree} .ticl-e-tree-node-text`)).find((node) => node.textContent === name)
        ?.parentElement ?? null
    );
  }

  async function menu(tree: string, name: string) {
    await conn.getValue(path);
    flushSync(() => {});
    row(tree, name).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2, clientX: 30, clientY: 30}));
    const popup = (await shouldHappen(() =>
      document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')
    )) as HTMLElement;
    return Array.from(popup.querySelectorAll<HTMLElement>('.ticl-e-dropdown-menu-item'));
  }

  it('defaults navigation double-click to Design for a main flow', () => {
    row('navigation', path).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(designFlow).toHaveBeenCalledTimes(1);
    expect(designFlow.mock.calls[0][0]).toBe(path);
    expect(editFlow).not.toHaveBeenCalled();
  });

  it('defaults component-node double-click to Open Flow', () => {
    row('outline', 'button').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(editFlow).toHaveBeenCalledTimes(1);
    expect(editFlow.mock.calls[0]).toEqual([`${path}.#main.button`, null]);
    expect(designFlow).not.toHaveBeenCalled();
  });

  it('defaults Outline double-click to Open Flow even when Design is available', async () => {
    openFlowStage();
    await shouldHappen(() => context.activeStage?.kind === 'dataflow' && row('outline', path));
    row('outline', path).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(editFlow).toHaveBeenCalledTimes(1);
    expect(editFlow.mock.calls[0][0]).toBe(path);
    expect(designFlow).not.toHaveBeenCalled();
    const items = await menu('outline', path);
    expect(items.some((item) => item.textContent === 'Design')).toBe(true);
  });

  it('shares the Outline selection with dataflow stages and restores each stage selection when switching', async () => {
    const designerStage = stage;
    openFlowStage();
    await shouldHappen(() => context.activeStage?.kind === 'dataflow' && div.querySelector('.flow .ticl-e-block'));
    const flowStage = context.activeStage;
    expect(flowStage.conn).toBe(conn);
    expect(div.querySelector('.flow .ticl-e-property-list')).toBeNull();
    const propertyToggle = div.querySelector<HTMLButtonElement>('.flow .ticl-e-stage-toolbar button');
    propertyToggle.click();
    await shouldHappen(() => div.querySelector('.flow .ticl-e-property-list'));
    propertyToggle.click();
    await shouldHappen(() => !div.querySelector('.flow .ticl-e-property-list'));

    await conn.setValue(`${path}.calculation.0`, 4, true);
    expect(context.runStageCommand('undo')).toBe(true);
    await shouldHappen(() => Root.instance.queryValue(`${path}.calculation.0`) === 1);
    expect(context.runStageCommand('redo')).toBe(true);
    await shouldHappen(() => Root.instance.queryValue(`${path}.calculation.0`) === 4);

    const selectedOutline = () =>
      div.querySelector('.outline .ticl-e-tree-node-selected .ticl-e-tree-node-text')?.textContent;
    const selectedBlock = () =>
      div.querySelector('.flow .ticl-e-stage-scroll .ticl-e-block-selected .ticl-e-block-head-label')?.textContent;
    flowStage.select([`${path}.calculation`]);
    await shouldHappen(() => selectedOutline() === 'calculation' && selectedBlock() === 'calculation');
    row('outline', '#main').click();
    await shouldHappen(() => selectedBlock() === '#main');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main`]);

    context.activateStage(designerStage.id);
    await shouldHappen(() => context.activeStage?.kind === 'designer' && selectedOutline() === 'button');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main.button`]);
    expect(row('outline', 'calculation')).toBeNull();

    context.activateStage(flowStage.id);
    await shouldHappen(() => context.activeStage?.kind === 'dataflow' && selectedOutline() === '#main');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main`]);
    expect(row('outline', 'calculation')).not.toBeNull();
  });

  it('offers both actions for a main flow and can choose Design', async () => {
    const items = await menu('navigation', path);
    expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining(['Design', 'Open Flow']));
    items.find((item) => item.textContent === 'Design').click();
    expect(designFlow).toHaveBeenCalledTimes(1);
    expect(designFlow.mock.calls[0][0]).toBe(path);
    expect(editFlow).not.toHaveBeenCalled();
  });

  it.each([
    ['worker', WorkerFlow, true],
    ['editor', FlowEditor, false],
  ] as const)('offers Design and defaults to it only for supported flows: %s', async (name, FlowClass, canDesign) => {
    const flow = Root.instance.queryValue(path) as Flow;
    flow.createOutputFlow<Flow>(FlowClass, name, {});
    row('navigation', path).parentElement.querySelector<HTMLElement>('.ticl-e-tree-arr').click();
    await shouldHappen(() => row('navigation', name));
    await conn.getValue(`${path}.${name}`);
    flushSync(() => {});
    row('navigation', name).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(canDesign ? designFlow : editFlow).toHaveBeenCalledTimes(1);
    expect((canDesign ? designFlow : editFlow).mock.calls[0][0]).toBe(`${path}.${name}`);
    expect(canDesign ? editFlow : designFlow).not.toHaveBeenCalled();
    const items = await menu('navigation', name);
    expect(items.some((item) => item.textContent === 'Design')).toBe(canDesign);
    expect(items.some((item) => item.textContent === 'Open Flow')).toBe(true);
  });

  it.each(['navigation', 'outline'])('hides Design for ordinary nodes in the %s menu', async (tree) => {
    const name = tree === 'navigation' ? 'calculation' : 'button';
    if (tree === 'navigation') {
      row('navigation', path).parentElement.querySelector<HTMLElement>('.ticl-e-tree-arr').click();
      await shouldHappen(() => row(tree, name));
    }
    const items = await menu(tree, name);
    expect(items.some((item) => item.textContent === 'Design')).toBe(false);
    expect(items.some((item) => item.textContent === 'Open Flow')).toBe(true);
  });

  it.each(['navigation', 'outline'])('can choose Open Flow from the %s menu', async (tree) => {
    const name = tree === 'navigation' ? path : 'button';
    const items = await menu(tree, name);
    items.find((item) => item.textContent === 'Open Flow').click();
    expect(editFlow).toHaveBeenCalledTimes(1);
    expect(editFlow.mock.calls[0][0]).toBe(tree === 'navigation' ? path : `${path}.#main.button`);
    expect(designFlow).not.toHaveBeenCalled();
  });
});
