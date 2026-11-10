import React from 'react';
import {userEvent} from 'vitest/browser';
import {ErrorEvent, Root, WAIT} from '@ticlo/core';
import type {Block, Flow} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {BlockStage} from '../BlockStage.tsx';
import {BlockView} from '../Block.tsx';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

describe('Block runtime status', () => {
  let flow: Flow;
  beforeEach(async () => {
    await initEditor();
  });
  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('BlockStatusTest');
    vi.restoreAllMocks();
  });

  it('shows transported errors and wait state on the right block without rerendering block bodies', async () => {
    flow = Root.instance.addFlow('BlockStatusTest', {
      first: {'#is': '', '@b-xyw': [50, 50, 200]},
      second: {'#is': '', '@b-xyw': [350, 50, 0]},
    });
    const first = flow.getValue('first') as Block;
    const second = flow.getValue('second') as Block;
    first.emit(new ErrorEvent(undefined, new Error('bad SQL')));
    second.emit(new ErrorEvent('timeout', 'second error'));
    const [, conn] = makeLocalConnection(Root.instance, true);
    const [, div] = loadTemplate(<BlockStage conn={conn} basePath="BlockStatusTest" />, 'editor');
    await shouldHappen(() => div.querySelectorAll('.ticl-e-block-error').length === 2);
    const block = div.querySelector('.ticl-e-block:not(.ticl-e-block-min)');
    const render = vi.spyOn(BlockView.prototype, 'renderImpl');
    await userEvent.click(block.querySelector('.ticl-e-block-error'));
    await shouldHappen(() => document.querySelector('.ticl-e-block-error-message')?.textContent === 'bad SQL');
    expect(document.querySelector('.ant-popover-title')?.textContent).toBe('Error');
    await userEvent.click(document.querySelector('.ticl-e-block-error-message'));
    expect(div.querySelector('.ticl-e-block-selected')).toBeNull();
    first.emit(WAIT);
    await shouldHappen(() => block.querySelector('.ticl-e-block-wait'));
    expect(block.querySelector('.ticl-e-block-error')).toBeNull();
    first.emitOnly(new ErrorEvent('validation', 'still waiting'));
    await shouldHappen(() => block.querySelector('.ticl-e-block-error'));
    expect(block.querySelector('.ticl-e-block-wait')).not.toBeNull();
    first.emit(undefined);
    await shouldHappen(() => !block.querySelector('.ticl-e-block-status'));
    expect(div.querySelectorAll('.ticl-e-block-error').length).toBe(1);
    await waitTick(20);
    render.mockClear();
    first.emit(new ErrorEvent('validation', 'invalid input'));
    await shouldHappen(() => block.querySelector('.ticl-e-block-error'));
    expect(render).not.toHaveBeenCalled();
  });
});
