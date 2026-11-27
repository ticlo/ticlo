import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {FunctionView} from '../../function-selector/FunctionView.tsx';
import type {Flow} from '@ticlo/core';
import {Block, globalFunctions, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, fakeMouseEvent} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';

describe('editor BlockAddon', function () {
  let flow: Flow;

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
    if (flow) {
      Root.instance.deleteValue(flow.getName());
      flow = null;
    }
  });

  function dragFuncToElement(funcView: HTMLElement, target: HTMLElement) {
    const srcRect = funcView.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = srcRect.left + srcRect.width / 2;
    const startY = srcRect.top + srcRect.height / 2;
    const dropX = targetRect.left + targetRect.width / 2;
    const dropY = targetRect.top + targetRect.height / 2;

    simulate(funcView, 'mousedown', fakeMouseEvent(startX, startY, {button: 0}));
    simulate(document.body, 'mousemove', fakeMouseEvent(startX + 16, startY + 16));
    simulate(document.body, 'mousemove', fakeMouseEvent(dropX, dropY));
    const rejected = Boolean(document.querySelector('.dragging-layer .drag-accept-reject'));
    simulate(document.body, 'mouseup', fakeMouseEvent(dropX, dropY));
    return rejected;
  }

  it('drops addon functions onto block footer, renders rounded squares, selects addons, and deletes selected addon', async function () {
    flow = Root.instance.addFlow('BlockAddonStage1', {
      add: {
        '#is': 'add',
        '@b-xyw': [120, 120, 143],
        '@b-p': ['0', '1', '#output'],
      },
    });

    const [, client] = makeLocalConnection(Root.instance);
    const logDesc = globalFunctions.getDesc('log');
    const addDesc = globalFunctions.getDesc('add');
    let stage: BlockStage;
    let selectedPaths: string[] = [];

    const [, div] = loadTemplate(
      <>
        <div style={{display: 'flex', height: '32px'}}>
          <FunctionView conn={client} desc={logDesc} />
          <FunctionView conn={client} desc={addDesc} />
        </div>
        <BlockStage
          ref={(v) => {
            stage = v;
          }}
          conn={client}
          basePath="BlockAddonStage1"
          onSelect={(paths) => {
            selectedPaths = paths;
          }}
          style={{width: '800px', height: '800px'}}
        />
      </>,
      'editor'
    );

    await shouldHappen(
      () => div.querySelector('.ticl-e-block-foot') && div.querySelectorAll('.ticl-e-func-view').length === 2
    );

    const [logView, addView] = Array.from(div.querySelectorAll('.ticl-e-func-view')) as HTMLElement[];
    const blockEl = div.querySelector('.ticl-e-block') as HTMLElement;
    const footEl = blockEl.querySelector('.ticl-e-block-foot') as HTMLElement;

    // Non-addon function cannot be dropped onto footer as an addon
    dragFuncToElement(addView, footEl);
    await client.getValue('BlockAddonStage1.add');
    expect(flow.queryValue('add.#addon')).toBeUndefined();
    expect(footEl.querySelectorAll('.ticl-e-block-addon').length).toBe(0);

    // Drop log addon #1
    expect(dragFuncToElement(logView, footEl)).toBe(false);
    await shouldHappen(() => footEl.querySelectorAll('.ticl-e-block-addon').length === 1);

    const addon1 = flow.queryValue('add.#-log') as Block;
    expect(addon1).toBeInstanceOf(Block);
    expect(addon1.getValue('#mode')).toBe('onCall');
    expect(addon1.getProperty('#call')._bindingPath).toBe('##.#emit');
    expect(flow.queryValue('add.#addon')).toEqual(['#-log']);
    expect(selectedPaths).toEqual(['BlockAddonStage1.add.#-log']);
    expect(blockEl.classList.contains('ticl-e-block-selected')).toBe(false);

    // Drop log addon #2
    expect(dragFuncToElement(logView, footEl)).toBe(false);
    await shouldHappen(() => footEl.querySelectorAll('.ticl-e-block-addon').length === 2);
    expect(flow.queryValue('add.#addon')).toEqual(['#-log', '#-log1']);
    expect(selectedPaths).toEqual(['BlockAddonStage1.add.#-log1']);

    const addonEls = Array.from(footEl.querySelectorAll('.ticl-e-block-addon')) as HTMLElement[];
    expect(addonEls[0].classList.contains('ticl-e-block-addon-selected')).toBe(false);
    expect(addonEls[1].classList.contains('ticl-e-block-addon-selected')).toBe(true);
    expect(window.getComputedStyle(addonEls[1]).boxShadow).not.toBe('none');

    // Click first addon -> selects first addon and deselects parent block
    simulate(addonEls[0], 'mousedown');
    simulate(addonEls[0], 'click');
    await shouldHappen(() => addonEls[0].classList.contains('ticl-e-block-addon-selected'));
    expect(addonEls[1].classList.contains('ticl-e-block-addon-selected')).toBe(false);
    expect(blockEl.classList.contains('ticl-e-block-selected')).toBe(false);
    expect(selectedPaths).toEqual(['BlockAddonStage1.add.#-log']);
    expect(window.getComputedStyle(addonEls[0]).boxShadow).not.toBe('none');

    // Click blank footer area -> deselects addon and selects parent block
    simulate(footEl, 'mousedown');
    simulate(document.body, 'mouseup');
    await shouldHappen(() => blockEl.classList.contains('ticl-e-block-selected'));
    expect(addonEls[0].classList.contains('ticl-e-block-addon-selected')).toBe(false);
    expect(selectedPaths).toEqual(['BlockAddonStage1.add']);

    // Select second addon again and delete via deleteSelection
    simulate(addonEls[1], 'mousedown');
    simulate(addonEls[1], 'click');
    await shouldHappen(() => addonEls[1].classList.contains('ticl-e-block-addon-selected'));
    expect(stage.deleteSelection()).toBe(true);

    await shouldHappen(() => footEl.querySelectorAll('.ticl-e-block-addon').length === 1);
    expect(flow.queryValue('add.#-log1')).toBeUndefined();
    expect(flow.queryValue('add.#addon')).toEqual(['#-log']);
    expect(selectedPaths).toEqual([]);
  });

  it.each([{allowCreateBlock: false}, {denyProps: ['#addon']}])(
    'blocks addon drop on footer when policy %j denies it',
    async function (policy) {
      flow = Root.instance.addFlow('BlockAddonPolicy', {
        add: {
          '#is': 'add',
          '@b-xyw': [120, 120, 143],
          '@b-p': ['0'],
        },
      });

      const [, base] = makeLocalConnection(Root.instance);
      const client = base.withPolicy(policy);
      const logDesc = globalFunctions.getDesc('log');

      const [, div] = loadTemplate(
        <>
          <div style={{height: '32px'}}>
            <FunctionView conn={client} desc={logDesc} />
          </div>
          <BlockStage conn={client} basePath="BlockAddonPolicy" style={{width: '800px', height: '800px'}} />
        </>,
        'editor'
      );

      await shouldHappen(() => div.querySelector('.ticl-e-block-foot') && div.querySelector('.ticl-e-func-view'));

      const logView = div.querySelector('.ticl-e-func-view') as HTMLElement;
      const footEl = div.querySelector('.ticl-e-block-foot') as HTMLElement;

      expect(dragFuncToElement(logView, footEl)).toBe(true);
      await client.getValue('BlockAddonPolicy.add');
      expect(flow.queryValue('add.#-log')).toBeUndefined();
      expect(flow.queryValue('add.#addon')).toBeUndefined();
      expect(footEl.querySelectorAll('.ticl-e-block-addon').length).toBe(0);
    }
  );
});
