import React, {StrictMode, useContext, useState} from 'react';
import {expectTypeOf, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {BlockStage} from '../../block/BlockStage.tsx';
import {TicloApp} from '../TicloApp.tsx';
import {useTicloStage} from '../useTicloStage.ts';
import {
  TicloCurrentFlowContext,
  TicloLayoutContextType,
  type TicloCurrentFlow,
  type TicloLayoutContext,
  type TicloStage,
} from '../LayoutContext.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';

describe('TicloApp stage registry', () => {
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('TicloAppSelection');
  });

  it('shares active stages and preserves keyboard commands when stages change or close', async () => {
    const save = vi.fn(() => true);
    const first: TicloStage = {
      id: 'first',
      basePath: 'first',
      kind: 'dataflow',
      selection: {paths: []},
      select: vi.fn(),
      save,
    };
    const second: TicloStage = {
      id: 'second',
      basePath: 'second',
      kind: 'custom',
      selection: {paths: []},
      select: vi.fn(),
    };
    interface CustomLayoutContext extends TicloLayoutContext {
      workspaceName: string;
    }
    const CustomLayoutContextType = TicloLayoutContextType as React.Context<CustomLayoutContext>;
    let context: TicloCurrentFlow;
    let layoutContext: CustomLayoutContext;
    let replaceSecond: (stage: TicloStage) => void;
    let closeSecond: () => void;
    function Register({stage}: {stage: TicloStage}): null {
      useTicloStage(stage);
      return null;
    }
    function Contents() {
      context = useContext(TicloCurrentFlowContext);
      layoutContext = useContext(CustomLayoutContextType);
      const [stage, setStage] = useState(second);
      const [open, setOpen] = useState(true);
      replaceSecond = setStage;
      closeSecond = () => setOpen(false);
      return (
        <>
          <Register stage={first} />
          {open && <Register stage={stage} />}
          <input />
        </>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <TicloApp<CustomLayoutContext> value={{workspaceName: 'Example'}}>
          <Contents />
        </TicloApp>
      </StrictMode>
    );
    await shouldHappen(() => context?.activeStage === second);
    expect(layoutContext.workspaceName).toBe('Example');
    context.onFlowFocus('first');
    await shouldHappen(() => context.activeStage === first);
    const saveKey = new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true, cancelable: true});
    div.querySelector('.ticl-e-app').dispatchEvent(saveKey);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveKey.defaultPrevented).toBe(true);

    context.onFlowFocus('second');
    await shouldHappen(() => context.activeStage === second);
    div
      .querySelector('.ticl-e-app')
      .dispatchEvent(new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true}));
    expect(save).toHaveBeenCalledTimes(1);
    const updated: TicloStage = {...second, copy: vi.fn(() => true)};
    replaceSecond(updated);
    await shouldHappen(() => context.activeStage === updated);
    const copyKey = new KeyboardEvent('keydown', {key: 'c', ctrlKey: true, bubbles: true, cancelable: true});
    div.querySelector('.ticl-e-app').dispatchEvent(copyKey);
    expect(updated.copy).toHaveBeenCalledTimes(1);
    div.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', {key: 'c', ctrlKey: true, bubbles: true}));
    expect(updated.copy).toHaveBeenCalledTimes(1);

    closeSecond();
    await shouldHappen(() => context.activeStage === null);
    context.onFlowFocus('first');
    await shouldHappen(() => context.activeStage === first);
    context.onFlowClosed('first');
    await shouldHappen(() => context.activeStage === null && context.currentPath === null);
  });

  it('routes all commands to one stage ID even when views share a flow', async () => {
    let context: TicloCurrentFlow;
    function Panel(): null {
      context = useContext(TicloCurrentFlowContext);
      return null;
    }
    const [, div] = loadTemplate(
      <TicloApp value={{}}>
        <Panel />
      </TicloApp>
    );
    await shouldHappen(() => context != null);
    const first = {
      id: 'dataflow',
      basePath: 'shared',
      kind: 'dataflow',
      selection: {paths: [] as string[]},
      select: vi.fn(),
      save: vi.fn(() => true),
      copy: vi.fn(() => true),
      paste: vi.fn(() => true),
      undo: vi.fn(() => true),
      redo: vi.fn(() => true),
      deleteSelection: vi.fn(() => true),
    };
    const second: TicloStage = {
      id: 'designer',
      basePath: 'shared',
      kind: 'designer',
      selection: {paths: []},
      select: vi.fn(),
      copy: vi.fn(() => false),
      paste: vi.fn(() => false),
    };
    context.registerStage(first);
    context.activateStage(second.id);
    expect(context.runStageCommand('copy')).toBe(false);
    context.registerStage(second);
    const host = div.querySelector('.ticl-e-app');
    for (const [key, modifiers] of [
      ['s', {ctrlKey: true}],
      ['c', {metaKey: true}],
      ['z', {ctrlKey: true}],
      ['z', {ctrlKey: true, shiftKey: true}],
      ['y', {ctrlKey: true}],
      ['Delete', {}],
    ] as [string, KeyboardEventInit][]) {
      const event = new KeyboardEvent('keydown', {key, ...modifiers, bubbles: true, cancelable: true});
      host.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    host.dispatchEvent(new ClipboardEvent('paste', {bubbles: true}));
    for (const command of ['save', 'copy', 'paste', 'undo', 'redo', 'deleteSelection'] as const) {
      expect(first[command]).not.toHaveBeenCalled();
    }
    expect(second.copy).toHaveBeenCalledTimes(1);
    expect(second.paste).toHaveBeenCalledTimes(1);

    // Updating a background snapshot must not activate it.
    const updated = {...first, selection: {paths: ['shared.a']}};
    context.registerStage(updated);
    await shouldHappen(() => context.activeStage === second);
    expect(context.currentPath).toBe('shared');
    // Activation and execution can happen before React renders the new context.
    context.activateStage(first.id);
    expect(context.runStageCommand('copy')).toBe(true);
    expect(first.copy).toHaveBeenCalledTimes(1);
    await shouldHappen(() => context.activeStage === updated);
    context.onFlowFocus('shared');
    expect(context.runStageCommand('save')).toBe(true);
    expect(first.save).toHaveBeenCalledTimes(1);
    context.unregisterStage(second.id);
    await shouldHappen(() => context.activeStage === updated);
    context.unregisterStage(first.id);
    expect(context.runStageCommand('copy')).toBe(false);
    await shouldHappen(() => context.activeStage === null && context.currentPath === null);
  });

  it('exposes path-only selection and updates consumers when the dataflow stage selects or deletes nodes', async () => {
    expectTypeOf<TicloCurrentFlow['activeStage']['selection']>().toEqualTypeOf<{paths: string[]}>();
    const path = 'TicloAppSelection';
    const flow = Root.instance.addFlow(path, {
      a: {'#is': 'add', '@b-xyw': [100, 100, 200]},
      b: {'#is': 'add', '@b-xyw': [400, 100, 200]},
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const onSelect = vi.fn();
    const onSave = vi.fn();
    let context: TicloCurrentFlow;
    let stage: BlockStage;
    function Panel() {
      context = useContext(TicloCurrentFlowContext);
      return <span data-testid="selection">{context.activeStage?.selection.paths.join(',')}</span>;
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <TicloApp value={{}}>
          <BlockStage
            ref={(value) => {
              stage = value;
            }}
            conn={conn}
            basePath={path}
            onSelect={onSelect}
            onSave={onSave}
          />
          <Panel />
        </TicloApp>
      </StrictMode>,
      'editor'
    );
    await shouldHappen(() => div.querySelectorAll('.ticl-e-block-head-label').length === 2);
    context.onFlowFocus(path);
    await shouldHappen(() => context.activeStage?.kind === 'dataflow');
    expect(context.activeStage.selection).toEqual({paths: []});

    context.activeStage.select([`${path}.a`]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === `${path}.a`);
    expect(div.querySelector('.ticl-e-stage-scroll .ticl-e-block-selected .ticl-e-block-head-label').textContent).toBe(
      'a'
    );
    expect(onSelect).toHaveBeenLastCalledWith([`${path}.a`]);

    stage.selectBlock(`${path}.b`);
    stage.onSelect();
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === `${path}.b`);
    expect(context.activeStage.selection).toEqual({paths: [`${path}.b`]});
    flow.deleteValue('b');
    await shouldHappen(() => context.activeStage.selection.paths.length === 0);

    context.activeStage.select([path]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === path);
    expect(div.querySelector('.ticl-e-stage-scroll .ticl-e-block-selected')).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith([path]);
    context.activeStage.select([]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === '');

    div
      .querySelector('.ticl-e-app')
      .dispatchEvent(new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true}));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
