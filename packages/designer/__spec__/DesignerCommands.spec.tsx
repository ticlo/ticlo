import React, {StrictMode, useContext, useState} from 'react';
import {vi} from 'vitest';
import {Block, Root, decode, encode, type Flow} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {BlockStage} from '@ticlo/editor/block/BlockStage.tsx';
import {TicloCurrentFlowContext, type TicloCurrentFlow} from '@ticlo/editor/component/LayoutContext.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';
import '../style/index.css';

function key(target: Element, value: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true, ...modifiers});
  target.dispatchEvent(event);
  return event;
}

function paste(target: Element, text: string) {
  const clipboardData = new DataTransfer();
  clipboardData.setData('Text', text);
  const event = new ClipboardEvent('paste', {clipboardData, bubbles: true, cancelable: true});
  target.dispatchEvent(event);
  return event;
}

describe('designer keyboard commands', () => {
  const path = 'DesignerCommandsTest';
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    vi.restoreAllMocks();
  });

  async function mount(onSave?: () => void) {
    const persist = vi.fn((flow: Flow) => flow.save());
    const flow = Root.instance.addFlow(
      path,
      {
        '#main': {
          '#is': 'react:div',
          '#order': ['container', 'outside'],
          'container': {
            '#is': 'react:div',
            '#order': ['a', 'b'],
            'a': {'#is': 'react:span', 'content': 'A'},
            'b': {'#is': 'react:span', 'content': 'B'},
          },
          'outside': {'#is': 'react:span', 'content': 'Outside'},
        },
      },
      {applyChange: persist}
    );
    const main = flow.getValue('#main') as Block;
    const container = main.getValue('container') as Block;
    const a = container.getValue('a') as Block;
    const b = container.getValue('b') as Block;
    const [server, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, div] = loadTemplate(
      <DesignerApp value={{}}>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} onSave={onSave} />
        <input className="property-input" />
        <Panel />
      </DesignerApp>
    );
    await shouldHappen(() => stage?.flow === flow && div.querySelector('.ticl-d-page span'));
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    return {flow, main, container, a, b, server, conn, persist, div, host, getStage: () => stage};
  }

  it.each([true, false])(
    'saves with Ctrl/Cmd+S, including from a property input (custom callback=%s)',
    async (custom) => {
      const onSave = vi.fn();
      const {div, host, conn, persist} = await mount(custom ? onSave : undefined);
      const apply = vi.spyOn(conn, 'applyFlowChange');
      expect(key(host.querySelector('span'), 's', {ctrlKey: true}).defaultPrevented).toBe(true);
      expect(key(div.querySelector('input'), 's', {metaKey: true}).defaultPrevented).toBe(true);
      if (custom) {
        expect(onSave).toHaveBeenCalledTimes(2);
        expect(apply).not.toHaveBeenCalled();
      } else {
        await shouldHappen(() => persist.mock.calls.length > 0);
        expect(apply).toHaveBeenCalledTimes(2);
      }
    }
  );

  it('deletes selected roots once, updates child order, and supports undo and both redo shortcuts', async () => {
    const {main, container, a, b, conn, host, getStage} = await mount();
    const remove = vi.spyOn(conn, 'deleteBlock');
    getStage().select([container, a, b, main.getValue('outside') as Block]);
    await shouldHappen(() => getStage().selection.blocks.length === 4);
    expect(key(host, 'Delete').defaultPrevented).toBe(true);
    await shouldHappen(() => !main.getValue('container') && getStage().selection.blocks.length === 0);
    expect(main.getValue('#order')).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(2);

    key(host, 'z', {metaKey: true});
    await shouldHappen(() => main.getValue('container') instanceof Block);
    key(host, 'z', {ctrlKey: true, shiftKey: true});
    await shouldHappen(() => !main.getValue('container'));
    key(host, 'z', {ctrlKey: true});
    await shouldHappen(() => main.getValue('container') instanceof Block);
    key(host, 'y', {ctrlKey: true});
    await shouldHappen(() => !main.getValue('container'));
  });

  it('copies components and pastes renamed siblings, or into main with no selection', async () => {
    const {main, container, a, b, host, getStage} = await mount();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    getStage().select([a, b]);
    await shouldHappen(() => getStage().selection.blocks.length === 2);
    expect(key(host, 'c', {ctrlKey: true}).defaultPrevented).toBe(true);
    await shouldHappen(() => write.mock.calls.length === 1);
    const text = write.mock.calls[0][0];
    expect(decode(text)).toMatchObject({a: {'#is': 'react:span'}, b: {'#is': 'react:span'}});

    expect(paste(host, text).defaultPrevented).toBe(true);
    await shouldHappen(
      () => container.getValue('a1') instanceof Block && getStage().selection.blocks[0] === container.getValue('a1')
    );
    expect(container.getValue('#order')).toEqual(['a', 'b', 'a1', 'b1']);
    expect(getStage().selection.blocks).toEqual([container.getValue('a1'), container.getValue('b1')]);
    await shouldHappen(() => host.querySelector('.ticl-d-page').textContent === 'ABABOutside');

    getStage().select([]);
    await shouldHappen(() => !getStage().selection.blocks.length);
    paste(host, text);
    await shouldHappen(
      () => main.getValue('a') instanceof Block && getStage().selection.blocks[0] === main.getValue('a')
    );
    expect(main.getValue('#order')).toEqual(['container', 'outside', 'a', 'b']);
    await shouldHappen(() => host.querySelector('.ticl-d-page').textContent === 'ABABOutsideAB');
  });

  it('leaves text editing and preview input alone', async () => {
    const {container, a, conn, div, host, getStage} = await mount();
    const remove = vi.spyOn(conn, 'deleteBlock');
    const copy = vi.spyOn(conn, 'copy');
    const insert = vi.spyOn(conn, 'paste');
    getStage().select([a]);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    const input = div.querySelector('input');
    expect(key(input, 'Delete').defaultPrevented).toBe(false);
    expect(key(input, 'c', {ctrlKey: true}).defaultPrevented).toBe(false);
    expect(paste(input, 'text').defaultPrevented).toBe(false);
    getStage().setDesignMode(false);
    await shouldHappen(() => !getStage().designMode);
    expect(key(host, 'Delete').defaultPrevented).toBe(false);
    expect(key(host, 'c', {ctrlKey: true}).defaultPrevented).toBe(false);
    expect(paste(host, 'text').defaultPrevented).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(container.getValue('a')).toBe(a);
  });

  it('respects live save, deletion, and creation policy changes', async () => {
    const onSave = vi.fn();
    const {container, a, server, conn, host, getStage} = await mount(onSave);
    const remove = vi.spyOn(conn, 'deleteBlock');
    const insert = vi.spyOn(conn, 'paste');
    server.setEditPolicy({allowDeleteBlock: false, allowCreateBlock: false, denyCmds: ['applyFlowChange']});
    await shouldHappen(() => conn.getEditPolicyView().policy?.allowDeleteBlock === false);
    getStage().select([a]);
    await shouldHappen(() => getStage().selection.blocks[0] === a);
    key(host, 's', {ctrlKey: true});
    key(host, 'Delete');
    paste(host, encode({copied: {'#is': 'react:span', 'content': 'Copied'}}));
    expect(onSave).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(container.getValue('a')).toBe(a);
  });

  it('keeps commands and selection scoped to the focused view when dataflow and designer share a flow', async () => {
    const flow = Root.instance.addFlow(path, {
      '#main': {'#is': 'react:div', '#order': ['a'], 'a': {'#is': 'react:span', 'content': 'A'}},
      'calc': {'#is': 'add'},
    });
    const main = flow.getValue('#main') as Block;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    const copy = vi.spyOn(conn, 'copy');
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const saveDesigner = vi.fn();
    const saveDataflow = vi.fn();
    let context: TicloCurrentFlow;
    let dataflow: BlockStage;
    let closeDataflow: () => void;
    function Contents() {
      context = useContext(TicloCurrentFlowContext);
      const [open, setOpen] = useState(true);
      closeDataflow = () => setOpen(false);
      return (
        <>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} stageId="design" onSave={saveDesigner} />
          {open && (
            <BlockStage
              ref={(stage) => {
                dataflow = stage;
              }}
              conn={conn}
              basePath={path}
              stageId="dataflow"
              onSave={saveDataflow}
            />
          )}
          <input />
        </>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <DesignerApp value={{}}>
          <Contents />
        </DesignerApp>
      </StrictMode>,
      'editor'
    );
    await shouldHappen(() => context && dataflow?.getBlock(`${path}.calc`));
    div.querySelector<HTMLElement>('.ticl-d-stage').focus();
    await shouldHappen(() => context.activeStage?.id === 'design');
    const designer = context.activeStage as DesignerStageContextValue;
    designer.select([main.getValue('a') as Block]);
    await shouldHappen(() => context.activeStage.selection.paths[0] === `${path}.#main.a`);
    dataflow.select([`${path}.calc`]);
    await shouldHappen(() => dataflow.getBlock(`${path}.calc`).selected);
    expect(context.activeStage.id).toBe('design');
    const input = div.querySelector('input');
    key(input, 's', {ctrlKey: true});
    expect(saveDesigner).toHaveBeenCalledTimes(1);
    expect(saveDataflow).not.toHaveBeenCalled();
    key(div.querySelector('.ticl-e-app'), 'c', {ctrlKey: true});
    expect(copy).toHaveBeenLastCalledWith(`${path}.#main`, ['a']);

    div.querySelector<HTMLElement>('.ticl-e-stage').focus();
    await shouldHappen(() => context.activeStage.id === 'dataflow');
    expect(context.activeStage.selection.paths).toEqual([`${path}.calc`]);
    key(input, 's', {metaKey: true});
    expect(saveDataflow).toHaveBeenCalledTimes(1);
    key(div.querySelector('.ticl-e-app'), 'c', {metaKey: true});
    expect(copy).toHaveBeenLastCalledWith(path, ['calc']);
    paste(div.querySelector('.ticl-e-app'), encode({flowPaste: {'#is': 'react:span'}}));
    await shouldHappen(
      () =>
        flow.getValue('flowPaste') instanceof Block && context.activeStage.selection.paths.includes(`${path}.flowPaste`)
    );
    expect(main.getValue('#order')).toEqual(['a']);

    div.querySelector('.ticl-d-stage').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => context.activeStage.id === 'design');
    expect(context.activeStage.selection.paths).toEqual([`${path}.#main.a`]);
    paste(div.querySelector('.ticl-e-app'), encode({designPaste: {'#is': 'react:span'}}));
    await shouldHappen(
      () =>
        main.getValue('designPaste') instanceof Block &&
        context.activeStage.selection.paths.includes(`${path}.#main.designPaste`)
    );
    expect(flow.getValue('designPaste')).toBeUndefined();
    expect(main.getValue('#order')).toEqual(['a', 'designPaste']);
    closeDataflow();
    await shouldHappen(() => !div.querySelector('.ticl-e-stage'));
    expect(context.activeStage.id).toBe('design');
    expect(context.currentPath).toBe(path);
    key(input, 's', {ctrlKey: true});
    expect(saveDesigner).toHaveBeenCalledTimes(2);
    expect(saveDataflow).toHaveBeenCalledTimes(1);
  });
});
