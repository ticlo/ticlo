import {expect} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {FunctionView} from '../../function-selector/FunctionView.tsx';
import {type Flow, getDefaultFuncData, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {fakeMouseEvent, loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';
import {arrayEqual} from '@ticlo/core/editor.ts';

describe('editor ValueBlock', function () {
  let flow: Flow;

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    simulate(document.body, 'mouseup');
    removeLastTemplate();
    destroyLastLocalConnection();
    if (flow) {
      Root.instance.deleteValue(flow.getName());
      flow = null;
    }
  });

  it('registers value descriptor with default custom property in other category and creates on drop', async function () {
    flow = Root.instance.addFlow('ValueBlockCreate');
    const [, client] = makeLocalConnection(Root.instance);
    const desc = client.watchDesc('value');
    expect(desc).toBeDefined();
    expect(desc.view).toBe('value');
    expect(desc.category).toBeUndefined();
    expect(getDefaultFuncData(desc)).toEqual({
      '#is': 'value',
      '#custom': [{name: 'value', type: 'any'}],
      '@b-p': ['value'],
    });

    const [, div] = loadTemplate(
      <>
        <div style={{height: '32px'}}>
          <FunctionView conn={client} desc={desc} />
        </div>
        <BlockStage conn={client} basePath="ValueBlockCreate" style={{width: '800px', height: '800px'}} />
      </>,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-func-view') && div.querySelector('.ticl-e-stage-scroll'));
    const funcView = div.querySelector('.ticl-e-func-view') as HTMLDivElement;
    simulate(funcView, 'mousedown', fakeMouseEvent(16, 16, {button: 0}));
    simulate(document.body, 'mousemove', fakeMouseEvent(80, 80));
    simulate(document.body, 'mousemove', fakeMouseEvent(180, 180));
    simulate(document.body, 'mouseup', fakeMouseEvent(180, 180));

    await shouldHappen(() => flow.queryValue('value.@b-p'));
    expect(flow.queryValue('value.#is')).toBe('value');
    expect(flow.queryValue('value.#custom')).toEqual([{name: 'value', type: 'any'}]);
    expect(flow.queryValue('value.@b-p')).toEqual(['value']);
    expect(flow.queryValue('value.@b-inline')).toBeUndefined();
    await shouldHappen(() => div.querySelector('.ticl-e-block-value'));
  });

  it('renders left icon head without label or footer and supports drag, context menu, and minimize', async function () {
    flow = Root.instance.addFlow('ValueBlockLayout', {
      val: {
        '#is': 'value',
        '#custom': [
          {name: 'a', type: 'number'},
          {name: 'b', type: 'string'},
        ],
        'a': 10,
        'b': 'hi',
        '@b-xyw': [100, 120, 160],
        '@b-p': ['a', 'b'],
      },
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <BlockStage conn={client} basePath="ValueBlockLayout" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    const block = await shouldHappen(() => div.querySelector('.ticl-e-block-value') as HTMLDivElement);
    await shouldHappen(() => block.querySelectorAll('.ticl-e-field').length === 2);

    expect(block.querySelector('.ticl-e-block-head-label')).toBeNull();
    expect(block.querySelector('.ticl-e-block-foot')).toBeNull();
    expect(block.querySelector('.ticl-e-slot')).toBeNull();

    const head = block.querySelector('.ticl-e-block-head') as HTMLElement;
    const icon = head.querySelector('.tico') as HTMLElement;
    expect(icon).not.toBeNull();
    await shouldHappen(() => head.offsetWidth === 24 && block.offsetHeight >= 48);

    const headRect = head.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    expect(iconRect.left + iconRect.width / 2).toBeCloseTo(headRect.left + headRect.width / 2, 1);
    expect(iconRect.top + iconRect.height / 2).toBeCloseTo(headRect.top + headRect.height / 2, 1);

    // Drag head to move block
    simulate(head, 'mousedown', fakeMouseEvent(headRect.x + 12, headRect.y + 12));
    simulate(document.body, 'mousemove', fakeMouseEvent(headRect.x + 108, headRect.y + 60));
    simulate(document.body, 'mousemove', fakeMouseEvent(headRect.x + 108, headRect.y + 60));
    simulate(document.body, 'mouseup');
    await shouldHappen(() => arrayEqual(flow.queryValue('val.@b-xyw') as unknown[], [196, 168, 160]));
    await client.getValue('ValueBlockLayout.val.@b-xyw');

    // Double-click head to minimize and expand
    simulate(head, 'dblclick');
    await shouldHappen(() => block.classList.contains('ticl-e-block-min'));
    simulate(block.querySelector('.ticl-e-block-head'), 'dblclick');
    await shouldHappen(() => div.querySelector('.ticl-e-block-value') && !block.classList.contains('ticl-e-block-min'));

    // Right-click head opens BlockDropdown and allows Delete
    simulate(div.querySelector('.ticl-e-block-value .ticl-e-block-head'), 'contextmenu', {button: 2});
    const deleteItem = await shouldHappen(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '.ticl-e-dropdown:not(.ticl-e-dropdown-hidden) .ticl-e-dropdown-menu-item'
        ),
      ].find((el) => el.textContent?.includes('Delete'))
    );
    deleteItem.click();
    await shouldHappen(() => flow.getValue('val') === undefined);
  });

  it('hides field labels with #hideLabels and keeps wire dragging working including inline', async function () {
    flow = Root.instance.addFlow('ValueBlockHideLabels', {
      val: {
        '#is': 'value',
        '#hideLabels': true,
        '#custom': [{name: 'value', type: 'number'}],
        'value': 42,
        '@b-xyw': [60, 100, 140],
        '@b-p': ['value'],
      },
      add: {
        '#is': 'add',
        '@b-xyw': [240, 100, 130],
        '@b-p': ['0'],
      },
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <BlockStage conn={client} basePath="ValueBlockHideLabels" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    const block = await shouldHappen(
      () => div.querySelector('.ticl-e-block-value.ticl-e-block-hide-labels') as HTMLElement
    );
    const field = await shouldHappen(() => block.querySelector('.ticl-e-field') as HTMLElement);
    expect(block.querySelector('.ticl-e-field-name')).toBeNull();
    const fieldValue = field.querySelector('.ticl-e-field-value') as HTMLElement;
    await shouldHappen(() => fieldValue.getBoundingClientRect().width > 80);

    // Drag wire out from inline hidden-label field using its right-side drag strip
    await client.setValue('ValueBlockHideLabels.val.@b-inline', {value: true});
    const inlineField = await shouldHappen(
      () => block.querySelector('.ticl-e-field.ticl-e-field-inline') as HTMLElement
    );
    const inlineRect = inlineField.getBoundingClientRect();
    const target = querySingle("//div.ticl-e-field-name/span[text()='0']/../..", div);
    const to = target.getBoundingClientRect();
    const move = fakeMouseEvent(to.x + to.width / 2, to.y + to.height / 2);

    simulate(inlineField, 'mousedown', fakeMouseEvent(inlineRect.right - 4, inlineRect.y + inlineRect.height / 2));
    simulate(document.body, 'mousemove', fakeMouseEvent(inlineRect.right + 20, inlineRect.y + inlineRect.height / 2));
    simulate(target, 'mousemove', move);
    expect(document.querySelector('.ticl-e-drag-wire')).not.toBeNull();
    simulate(target, 'mouseup', move);
    await shouldHappen(() => flow.queryProperty('add.0')?._bindingPath);
    expect(flow.queryValue('add.0')).toBe(42);
    await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));
  });

  it('allows dragging bindings out of value block, rejects dropping bindings in, and keeps right-drag reorder', async function () {
    flow = Root.instance.addFlow('ValueBlockDragRules', {
      val: {
        '#is': 'value',
        '#custom': [
          {name: 'num', type: 'number'},
          {name: 'blk', type: 'block'},
        ],
        'num': 7,
        '@b-xyw': [60, 100, 140],
        '@b-p': ['num', 'blk'],
      },
      add: {
        '#is': 'add',
        '0': 5,
        '@b-xyw': [240, 100, 130],
        '@b-p': ['0', '1'],
      },
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <BlockStage conn={client} basePath="ValueBlockDragRules" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    const valBlock = await shouldHappen(() => div.querySelector('.ticl-e-block-value') as HTMLElement);
    const valNum = await shouldHappen(() => querySingle("//div.ticl-e-field-name/span[text()='num']/../..", valBlock));
    const valBlk = querySingle("//div.ticl-e-field-name/span[text()='blk']/../..", valBlock);
    const addZero = await shouldHappen(() => querySingle("//div.ticl-e-field-name/span[text()='0']/../..", div));
    const addHead = addZero.closest('.ticl-e-block').querySelector('.ticl-e-block-head');

    // 1. Drag from value block property -> add.1 succeeds
    const addOne = querySingle("//div.ticl-e-field-name/span[text()='1']/../..", div);
    const fromVal = valNum.getBoundingClientRect();
    const toAdd = addOne.getBoundingClientRect();
    const addMove = fakeMouseEvent(toAdd.x + toAdd.width / 2, toAdd.y + toAdd.height / 2);
    simulate(valNum, 'mousedown', fakeMouseEvent(fromVal.x + fromVal.width / 2, fromVal.y + fromVal.height / 2));
    simulate(document.body, 'mousemove', fakeMouseEvent(fromVal.x + 20, fromVal.y + 10));
    simulate(addOne, 'mousemove', addMove);
    simulate(addOne, 'mouseup', addMove);
    await shouldHappen(() => flow.queryProperty('add.1')?._bindingPath);
    expect(flow.queryValue('add.1')).toBe(7);

    // 2. Drag from add.0 -> val.num is rejected
    const fromAdd = addZero.getBoundingClientRect();
    const valNumMove = fakeMouseEvent(fromVal.x + fromVal.width / 2, fromVal.y + fromVal.height / 2);
    simulate(addZero, 'mousedown', fakeMouseEvent(fromAdd.x + fromAdd.width / 2, fromAdd.y + fromAdd.height / 2));
    simulate(document.body, 'mousemove', fakeMouseEvent(fromAdd.x - 20, fromAdd.y + 10));
    simulate(valNum, 'mousemove', valNumMove);
    expect(document.querySelector('.dragging-layer .drag-accept-reject')).not.toBeNull();
    simulate(valNum, 'mouseup', valNumMove);
    expect(flow.queryProperty('val.num')._bindingPath).toBeUndefined();

    // 3. Right-button drag reorders @b-p on value block
    const source = valNum.querySelector('.ticl-e-field-name > span');
    const target = valBlk.querySelector('.ticl-e-field-name > span');
    const sRect = source.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const down = fakeMouseEvent(sRect.x + 5, sRect.y + 5, {button: 2, buttons: 2});
    const reorderMove = fakeMouseEvent(tRect.x + 5, tRect.y + 5, {button: 2, buttons: 2});
    simulate(source, 'mousedown', down);
    simulate(target, 'mousemove', reorderMove);
    simulate(target, 'mouseup', {...reorderMove, buttons: 0});
    await shouldHappen(() => arrayEqual(flow.queryValue('val.@b-p') as unknown[], ['blk', 'num']));
    await client.getValue('ValueBlockDragRules.val.@b-p');

    // 4. Drag add block head -> val.blk is rejected
    const fromHead = addHead.getBoundingClientRect();
    const toBlk = valBlk.getBoundingClientRect();
    const blkMove = fakeMouseEvent(toBlk.x + toBlk.width / 2, toBlk.y + toBlk.height / 2);
    simulate(addHead, 'mousedown', fakeMouseEvent(fromHead.x + fromHead.width / 2, fromHead.y + fromHead.height / 2));
    simulate(valBlk, 'mousemove', blkMove);
    expect(document.querySelector('.dragging-layer .drag-accept-reject')).not.toBeNull();
    simulate(valBlk, 'mouseup', blkMove);
    expect(flow.queryProperty('val.blk')._bindingPath).toBeUndefined();
  });

  it.each([
    {
      name: 'value',
      blockData: {
        '#is': 'value',
        '#custom': [{name: 'value', type: 'any'}],
        '@b-xyw': [100, 100, 160],
        '@b-p': ['value'],
      },
      selector: '.ticl-e-block-value',
      selectTarget: '.ticl-e-block-head',
    },
    {
      name: 'note',
      blockData: {'#is': 'note', 'input': 'hello', '@b-xyw': [100, 100, 160]},
      selector: '.ticl-e-block-full-view',
      selectTarget: '.ticl-e-block-note',
    },
  ])(
    'shows floating bottom-right resize handle only when selected and hovered for $name block',
    async function ({blockData, selector, selectTarget}) {
      flow = Root.instance.addFlow('ValueBlockResize', {target: blockData});
      const [, client] = makeLocalConnection(Root.instance);
      const [, div] = loadTemplate(
        <BlockStage conn={client} basePath="ValueBlockResize" style={{width: '800px', height: '800px'}} />,
        'editor'
      );

      const block = await shouldHappen(() => div.querySelector(selector) as HTMLElement);
      const handle = await shouldHappen(() => block.querySelector('.ticl-e-width-drag') as HTMLElement);
      await shouldHappen(() => block.offsetWidth === 160);

      // Unselected + unhovered -> hidden
      expect(getComputedStyle(handle).opacity).toBe('0');
      expect(getComputedStyle(handle).pointerEvents).toBe('none');

      // Unselected + hovered -> still hidden
      await userEvent.hover(page.elementLocator(block));
      expect(getComputedStyle(handle).opacity).toBe('0');
      expect(getComputedStyle(handle).pointerEvents).toBe('none');

      // Select block, then unhover -> hidden
      const clickEl = block.querySelector(selectTarget) as HTMLElement;
      simulate(clickEl, 'mousedown', fakeMouseEvent(120, 110));
      simulate(document.body, 'mouseup');
      await shouldHappen(() => block.classList.contains('ticl-e-block-selected'));
      await userEvent.unhover(page.elementLocator(block));
      await shouldHappen(() => getComputedStyle(handle).opacity === '0');
      expect(getComputedStyle(handle).pointerEvents).toBe('none');

      // Selected + hovered -> visible below bottom-right and draggable
      await userEvent.hover(page.elementLocator(block));
      await shouldHappen(() => getComputedStyle(handle).opacity === '1');
      expect(getComputedStyle(handle).pointerEvents).toBe('auto');

      const blockRect = block.getBoundingClientRect();
      const handleRect = handle.getBoundingClientRect();
      expect(handleRect.top).toBeGreaterThanOrEqual(blockRect.bottom - 1);
      expect(Math.abs(handleRect.right - blockRect.right)).toBeLessThanOrEqual(1);

      simulate(handle, 'mousedown', fakeMouseEvent(handleRect.x + 10, handleRect.y + 8));
      simulate(document.body, 'mousemove', fakeMouseEvent(handleRect.x + 110, handleRect.y + 8));
      simulate(document.body, 'mousemove', fakeMouseEvent(handleRect.x + 110, handleRect.y + 8));
      await shouldHappen(() => block.offsetWidth === 260);
      await shouldHappen(() => arrayEqual(flow.queryValue('target.@b-xyw') as unknown[], [100, 100, 260]));
      simulate(document.body, 'mouseup');
      await client.getValue('ValueBlockResize.target.@b-xyw');
    }
  );

  it('hides resize handle when policy blocks writing @b-xyw', async function () {
    flow = Root.instance.addFlow('ValueBlockReadonly', {
      val: {'#is': 'value', '#custom': [{name: 'value', type: 'any'}], '@b-xyw': [100, 100, 160], '@b-p': ['value']},
    });
    const [, base] = makeLocalConnection(Root.instance);
    const client = base.withPolicy({readonly: true});
    const [, div] = loadTemplate(
      <EditPolicyProvider conn={client}>
        <BlockStage conn={client} basePath="ValueBlockReadonly" style={{width: '800px', height: '800px'}} />
      </EditPolicyProvider>,
      'editor'
    );
    const block = await shouldHappen(() => div.querySelector('.ticl-e-block-value') as HTMLElement);
    expect(block.querySelector('.ticl-e-width-drag')).toBeNull();
  });
});
