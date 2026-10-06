import React, {StrictMode, useContext, useEffect, useState} from 'react';
import {expectTypeOf, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {BlockStage} from '../../block/BlockStage.tsx';
import {TicloApp} from '../TicloApp.tsx';
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
    const first: TicloStage = {kind: 'dataflow', selection: {paths: []}, select: vi.fn(), save};
    const second: TicloStage = {kind: 'custom', selection: {paths: []}, select: vi.fn()};
    interface CustomLayoutContext extends TicloLayoutContext {
      workspaceName: string;
    }
    const CustomLayoutContextType = TicloLayoutContextType as React.Context<CustomLayoutContext>;
    let context: TicloCurrentFlow;
    let layoutContext: CustomLayoutContext;
    let replaceSecond: (stage: TicloStage) => void;
    let closeSecond: () => void;
    function Register({path, stage}: {path: string; stage: TicloStage}): null {
      const {registerStage, unregisterStage} = useContext(TicloCurrentFlowContext);
      useEffect(() => {
        registerStage(path, stage);
        return () => unregisterStage(path, stage);
      }, [path, stage, registerStage, unregisterStage]);
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
          <Register path="first" stage={first} />
          {open && <Register path="second" stage={stage} />}
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
    await shouldHappen(() => context != null);
    expect(layoutContext.workspaceName).toBe('Example');
    context.onFlowFocus('first');
    await shouldHappen(() => context.activeStage === first);
    const saveKey = new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true, cancelable: true});
    div.querySelector('.ticl-app').dispatchEvent(saveKey);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveKey.defaultPrevented).toBe(true);

    context.onFlowFocus('second');
    await shouldHappen(() => context.activeStage === second);
    div
      .querySelector('.ticl-app')
      .dispatchEvent(new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true}));
    expect(save).toHaveBeenCalledTimes(1);
    const updated: TicloStage = {...second, copy: vi.fn(() => true)};
    replaceSecond(updated);
    await shouldHappen(() => context.activeStage === updated);
    const copyKey = new KeyboardEvent('keydown', {key: 'c', ctrlKey: true, bubbles: true, cancelable: true});
    div.querySelector('.ticl-app').dispatchEvent(copyKey);
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
    await shouldHappen(() => div.querySelectorAll('.ticl-block-head-label').length === 2);
    context.onFlowFocus(path);
    await shouldHappen(() => context.activeStage?.kind === 'dataflow');
    expect(context.activeStage.selection).toEqual({paths: []});

    context.activeStage.select([`${path}.a`]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === `${path}.a`);
    expect(div.querySelector('.ticl-stage-scroll .ticl-block-selected .ticl-block-head-label').textContent).toBe('a');
    expect(onSelect).toHaveBeenLastCalledWith([`${path}.a`]);

    stage.selectBlock(`${path}.b`);
    stage.onSelect();
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === `${path}.b`);
    expect(context.activeStage.selection).toEqual({paths: [`${path}.b`]});
    flow.deleteValue('b');
    await shouldHappen(() => context.activeStage.selection.paths.length === 0);

    context.activeStage.select([path]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === path);
    expect(div.querySelector('.ticl-stage-scroll .ticl-block-selected')).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith([path]);
    context.activeStage.select([]);
    await shouldHappen(() => div.querySelector('[data-testid="selection"]').textContent === '');

    div
      .querySelector('.ticl-app')
      .dispatchEvent(new KeyboardEvent('keydown', {key: 's', ctrlKey: true, bubbles: true}));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
