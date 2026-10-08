import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {FunctionView} from '../../function-selector/FunctionView.tsx';
import type {Flow} from '@ticlo/core';
import {Block, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {FlowEditor} from '@ticlo/core/worker/FlowEditor.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle, fakeMouseEvent} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';
import {arrayEqual} from '@ticlo/core/editor.ts';

describe('editor BlockStage', function () {
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

  it('single block', async function () {
    flow = Root.instance.addFlow('BlockStage1');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '1': 2,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage1" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'), 500, 'find block');

    const block = div.querySelector('.ticl-e-block') as HTMLDivElement;

    // Wait for block to be positioned and CSS to apply
    await shouldHappen(
      () => {
        const computedStyle = window.getComputedStyle(block);
        return computedStyle.position === 'absolute' && block.offsetWidth === 345;
      },
      1000,
      'block positioned'
    );

    expect(block.offsetLeft).toBe(123);
    expect(block.offsetTop).toBe(234);
    expect(block.offsetWidth).toBe(345);

    // test all fields in the block body
    await shouldHappen(
      () => querySingle("//div.ticl-e-field-name/span[text()='0']/..//../../div.ticl-e-field-value[text()='1']", div),
      100,
      'find field 1'
    );
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='1']/..//../../div.ticl-e-field-value[text()='2']", div)
    ).not.toBeNull();
    await shouldHappen(
      () =>
        querySingle("//div.ticl-e-field-name/span[text()='#output']/..//../../div.ticl-e-field-value[text()='3']", div),
      500,
      'find output 3'
    );

    // check block icon
    expect(querySingle('//div.tico-icon-svg.tico-fas-plus', div)).not.toBeNull();

    // test value update
    flow.queryProperty('add.0').updateValue(5);
    await shouldHappen(
      () => querySingle("//div.ticl-e-field-name/span[text()='0']/..//../../div.ticl-e-field-value[text()='5']", div),
      100,
      'find field 5'
    );
    await shouldHappen(
      () =>
        querySingle("//div.ticl-e-field-name/span[text()='#output']/..//../../div.ticl-e-field-value[text()='7']", div),
      500,
      'find output 7'
    );

    // test change type
    flow.queryProperty('add.#is').setValue('subtract');
    await shouldHappen(
      () =>
        querySingle("//div.ticl-e-field-name/span[text()='#output']/..//../../div.ticl-e-field-value[text()='3']", div),
      100,
      'find field 3'
    );
    // check block icon again
    expect(querySingle('//div.tico-icon-svg.tico-fas-minus', div)).not.toBeNull();
  });

  it('opens block context menus on mouseup by default', async () => {
    flow = Root.instance.addFlow('BlockStageMenu', {
      block: {'#is': 'add', '@b-xyw': [100, 100, 200]},
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<BlockStage conn={client} basePath="BlockStageMenu" />, 'editor');
    await shouldHappen(() => div.querySelector('.tico-fas-plus'));
    const label = await shouldHappen(() => div.querySelector('.ticl-e-block-head-label'));
    const mouse = {button: 2, clientX: 150, clientY: 110};
    simulate(label, 'mousedown', {...mouse, buttons: 2});
    simulate(label, 'contextmenu', mouse);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
    simulate(label, 'mouseup', mouse);
    const menu = await shouldHappen(() => document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)'));
    expect(menu.textContent).toContain('Rename');
    simulate(document.body, 'keydown', {key: 'Escape'});
    await shouldHappen(() => !document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)'));
  });

  it('removes selected blocks from #order when deleting from the stage', async () => {
    flow = Root.instance.addFlow('BlockStageDelete', {
      '#order': ['a', 'b', 'missing'],
      'a': {'#is': 'add', '@b-xyw': [100, 100, 200]},
      'b': {'#is': 'add', '@b-xyw': [400, 100, 200]},
    });
    const [, client] = makeLocalConnection(Root.instance);
    let stage: BlockStage;
    const [, div] = loadTemplate(
      <BlockStage
        ref={(value) => {
          stage = value;
        }}
        conn={client}
        basePath="BlockStageDelete"
        style={{width: 800, height: 800}}
      />,
      'editor'
    );
    await shouldHappen(() => div.querySelectorAll('.ticl-e-block-head-label').length === 2);
    stage.selectBlock('BlockStageDelete.a', false);
    expect(stage.deleteSelection()).toBe(true);
    await shouldHappen(() => flow.getValue('a') === undefined);
    expect(flow.getValue('#order')).toEqual(['b', 'missing']);
    await shouldHappen(() => div.querySelectorAll('.ticl-e-block').length === 1);
  });

  it.each([undefined, {allowCreateBlock: false}])('drag block cursor with policy %j', async function (policy) {
    flow = Root.instance.addFlow('BlockStage2');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    const [, base] = makeLocalConnection(Root.instance);
    const client = base.withPolicy(policy);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage2" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'));

    const block = div.querySelector('.ticl-e-stage-scroll .ticl-e-block') as HTMLDivElement;

    // Wait for block to be positioned and CSS to apply
    await shouldHappen(
      () => {
        const computedStyle = window.getComputedStyle(block);
        return computedStyle.position === 'absolute' && block.offsetWidth === 345;
      },
      1000,
      'block positioned'
    );

    // mouse down
    simulate(document.querySelector('.ticl-e-stage-scroll .ticl-e-block-head'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });

    await shouldHappen(() => block.classList.contains('ticl-e-block-selected'));

    // mouse move to drag
    expect(block.offsetLeft).toBe(123);
    expect(block.offsetTop).toBe(234);
    simulate(document.body, 'mousemove', {
      clientX: 100,
      clientY: 100,
    });
    try {
      await shouldHappen(() => block.offsetLeft === 223);
      expect(block.offsetTop).toBe(334);
      expect(document.querySelector('.dragging-layer')).not.toBeNull();
      expect(document.querySelector('.dragging-layer .drag-accept-reject')).toBeNull();
    } finally {
      // mouse up to stop dragging, including when a cursor assertion fails
      simulate(document.body, 'mouseup');
    }

    await shouldHappen(() => arrayEqual((flow as Flow).queryValue('add.@b-xyw') as unknown[], [223, 334, 345]));

    // mouse move no longer drag block
    simulate(document.body, 'mousemove', {
      clientX: 200,
      clientY: 200,
    });
    await shouldReject(shouldHappen(() => block.offsetLeft !== 223));
  });

  it('drag block size', async function () {
    flow = Root.instance.addFlow('BlockStage3');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage3" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'));

    const block = div.querySelector('.ticl-e-stage-scroll .ticl-e-block') as HTMLDivElement;
    await shouldHappen(() => block.offsetWidth === 345);
    // mouse down
    simulate(document.querySelector('.ticl-e-width-drag'), 'mousedown', fakeMouseEvent());

    // mouse move to trigger drag start
    simulate(document.body, 'mousemove', fakeMouseEvent(100, 100));
    // mouse move to trigger drag move
    simulate(document.body, 'mousemove', fakeMouseEvent(100, 100));

    await shouldHappen(() => block.offsetWidth === 445);

    await shouldHappen(() => arrayEqual((flow as Flow).queryValue('add.@b-xyw') as unknown[], [123, 234, 445]));

    // mouse up to stop dragging
    simulate(document.body, 'mouseup');
  });

  it('shows block binding source by default and binds by dragging the header', async function () {
    flow = Root.instance.addFlow('BlockStageSelfBinding');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
      target: {
        '#is': '',
        '#custom': [{name: 'source', type: 'block'}],
        '~source': '##.add',
        '@b-xyw': [300, 100, 143],
        '@b-p': ['source'],
      },
      hidden: {
        '#is': '',
        '~source': '##.add',
        '@b-xyw': [500, 100, 143],
        '@b-p': [],
      },
    });

    const [, client] = makeLocalConnection(Root.instance);

    const [, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStageSelfBinding" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));
    const source = await shouldHappen(() => div.querySelector('.ticl-e-block-foot > .ticl-e-outbound'));
    const block = source.closest('.ticl-e-block') as HTMLDivElement;
    expect(div.querySelector('.ticl-e-block-self-drag')).toBeNull();
    await shouldHappen(() => block.offsetLeft === 100 && block.offsetTop === 100);

    const rect = source.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    simulate(source, 'mousedown', fakeMouseEvent(x, y));
    try {
      simulate(document.body, 'mousemove', fakeMouseEvent(x + 40, y + 30));
      expect(document.querySelector('.dragging-layer')).toBeNull();
      expect(block.offsetLeft).toBe(100);
      expect(block.offsetTop).toBe(100);
    } finally {
      simulate(document.body, 'mouseup');
    }

    flow.queryProperty('target.source').setValue(undefined);
    await shouldHappen(() => !div.querySelector('.ticl-e-block-wire'));
    await shouldHappen(() => !div.querySelector('.ticl-e-block-foot > .ticl-e-outbound'));

    const head = block.querySelector('.ticl-e-block-head');
    const target = querySingle("//div.ticl-e-field-name/span[text()='source']/../..", div);
    const from = head.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const move = fakeMouseEvent(to.x + to.width / 2, to.y + to.height / 2);
    simulate(head, 'mousedown', fakeMouseEvent(from.x + from.width / 2, from.y + from.height / 2));
    try {
      simulate(target, 'mousemove', move);
      simulate(target, 'mouseup', move);
      await shouldHappen(() => (flow as Flow).queryValue('target.source') === (flow as Flow).queryValue('add'));
      await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));
      expect(div.querySelector('.ticl-e-block-foot > .ticl-e-outbound')).not.toBeNull();
      expect(flow.queryValue('add.@b-xyw')).toEqual([100, 100, 143]);
    } finally {
      simulate(document.body, 'mouseup');
    }
  });

  it('shows static blocks created after stage mounts', async function () {
    flow = Root.instance.addFlow('BlockStageStaticCreate');
    FlowEditor.createFromFunction(flow, '#edit-func', ':worker-static-create', {'#is': ''});

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage
        conn={client}
        basePath="BlockStageStaticCreate.#edit-func"
        style={{width: '800px', height: '800px'}}
      />,
      'editor'
    );

    await client.addBlock('BlockStageStaticCreate.#edit-func.#static.add', {
      '#is': 'add',
      '@b-xyw': [100, 120, 143],
    });

    await shouldHappen(
      () => {
        const label = div.querySelector('.ticl-e-block-head-static .ticl-e-block-head-label');
        return label?.textContent === 'add' ? label.closest('.ticl-e-block') : null;
      },
      1000,
      'find static block'
    );

    const block = div.querySelector('.ticl-e-block-head-static')?.closest('.ticl-e-block') as HTMLDivElement;
    expect(block.offsetLeft).toBe(100);
    expect(block.offsetTop).toBe(120);
  });

  it.each([
    {policy: undefined, blocked: false},
    {policy: {allowCreateBlock: false}, blocked: true},
    {
      policy: {
        allowPaths: [
          'BlockStageAltStaticCreate.#edit-func.#static.add',
          'BlockStageAltStaticCreate.#edit-func.#static.add.**',
        ],
      },
      blocked: true,
    },
    {
      policy: {
        allowPaths: ['BlockStageAltStaticCreate.#edit-func.#static', 'BlockStageAltStaticCreate.#edit-func.#static.**'],
      },
      blocked: false,
    },
  ])('alt drag creation with policy $policy', async function ({policy, blocked}) {
    flow = Root.instance.addFlow('BlockStageAltStaticCreate');
    FlowEditor.createFromFunction(flow, '#edit-func', ':worker-alt-static-create', {'#is': ''});

    const [, base] = makeLocalConnection(Root.instance);
    const client = base.withPolicy(policy);
    const desc: any = {id: 'add', name: 'add', properties: []};

    const [component, div] = loadTemplate(
      <>
        <div style={{height: '32px'}}>
          <FunctionView conn={client} desc={desc} />
        </div>
        <BlockStage
          conn={client}
          basePath="BlockStageAltStaticCreate.#edit-func"
          style={{width: '800px', height: '800px'}}
        />
      </>,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-func-view') && div.querySelector('.ticl-e-stage-scroll'));

    const funcView = div.querySelector('.ticl-e-func-view') as HTMLDivElement;
    simulate(funcView, 'mousedown', fakeMouseEvent(16, 16, {button: 0, altKey: true}));
    simulate(document.body, 'mousemove', fakeMouseEvent(80, 80, {altKey: true}));
    simulate(document.body, 'mousemove', fakeMouseEvent(180, 180, {altKey: true}));
    try {
      expect(document.querySelector('.dragging-layer')).not.toBeNull();
      expect(Boolean(document.querySelector('.dragging-layer .drag-accept-reject'))).toBe(blocked);
    } finally {
      simulate(document.body, 'mouseup', fakeMouseEvent(180, 180));
    }

    // Wait for the drop's request/response cycle before tearing down its connection.
    await client.getValue('BlockStageAltStaticCreate.#edit-func.#static');
    if (blocked) {
      expect(flow.queryValue('#edit-func.#static.add')).toBeUndefined();
    } else {
      await shouldHappen(() => flow.queryValue('#edit-func.#static.add'));
    }
    expect(flow.queryValue('#edit-func.add')).not.toBeDefined();
  });

  it('min block and wire', async function () {
    flow = Root.instance.addFlow('BlockStage4');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0', '1'],
      },
      subtract: {
        '#is': 'subtract',
        '~0': '##.add.0',
        '@b-xyw': [200, 200, 143],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage4" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    // wait for the wire
    await shouldHappen(() => div.querySelector('svg.ticl-e-block-wire'));

    const addBlock = querySingle("//div.ticl-e-block-head.ticl-e-block-head-label[text()='add']/../..", div);
    expect(addBlock.offsetWidth).toBe(143);

    const wire = div.querySelector('svg.ticl-e-block-wire') as SVGSVGElement;

    // mousedown to select
    simulate(addBlock.querySelector('.ticl-e-stage-scroll .ticl-e-block-head'), 'mousedown');
    simulate(document.body, 'mouseup');
    // wire should have z index
    await shouldHappen(() => wire.style.zIndex === '100');

    // minimize the block
    simulate(addBlock.querySelector('.ticl-e-block-head'), 'dblclick');
    await shouldHappen(() => addBlock.offsetWidth === 24);
    expect(addBlock.offsetHeight).toBe(24);

    // wrie instance should be reused
    expect(div.querySelector('svg')).toBe(wire);

    // click the other block
    simulate(querySingle("//div.ticl-e-block-head.ticl-e-block-head-label[text()='subtract']/..", div), 'mousedown');
    // addBlock is no longer selected
    await shouldHappen(() => !addBlock.classList.contains('ticl-e-block-selected'));
    // since subtract block is now selected, wire should still have zindex
    expect(wire.style.zIndex).toBe('100');

    // expand block
    simulate(addBlock.querySelector('.ticl-e-block-head'), 'dblclick');
    await shouldHappen(() => addBlock.offsetWidth === 143);

    // wire should disappear when source not in stage
    flow.queryProperty('subtract.0').setBinding('##.unknown');
    await shouldHappen(() => div.querySelector('svg.ticl-e-block-wire') == null);

    // wire should be back when binding is set again
    flow.queryProperty('subtract.0').setBinding('##.add.1');
    await shouldHappen(() => div.querySelector('svg.ticl-e-block-wire'));

    // wire should disappear when unbound
    flow.queryProperty('subtract.0').setValue(1);
    await shouldHappen(() => div.querySelector('svg.ticl-e-block-wire') == null);
  });

  it('rect select', async function () {
    flow = Root.instance.addFlow('BlockStage5');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [100, 100, 100],
        '@b-p': ['0'],
      },
      subtract: {
        '#is': 'subtract',
        '@b-xyw': [200, 200, 100],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    let selectedPaths: string[];

    function onSelect(paths: string[]) {
      selectedPaths = paths;
    }

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage5" onSelect={onSelect} style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    // wait for the field
    await shouldHappen(() => (div.querySelector('.ticl-e-stage-bg') as HTMLElement)?.offsetWidth);
    // background
    const rectBg = div.querySelector('.ticl-e-stage-bg');

    // select all
    simulate(rectBg, 'mousedown', fakeMouseEvent(90, 90));
    simulate(rectBg, 'mouseup', fakeMouseEvent(310, 310));

    // both block are selected
    await shouldHappen(() => div.querySelectorAll('.ticl-e-stage-scroll .ticl-e-block-selected').length === 2);
    expect(selectedPaths).toEqual(['BlockStage5.add', 'BlockStage5.subtract']);

    // select all
    simulate(rectBg, 'mousedown', fakeMouseEvent(210, 210));
    simulate(rectBg, 'mouseup', fakeMouseEvent(90, 90));

    // one block selected
    await shouldHappen(() => div.querySelectorAll('.ticl-e-stage-scroll .ticl-e-block-selected').length === 1);
    expect(selectedPaths).toEqual(['BlockStage5.add']);

    // select none
    // select all
    simulate(rectBg, 'mousedown', fakeMouseEvent(90, 90));
    simulate(rectBg, 'mouseup', fakeMouseEvent(91, 89));

    // one block selected
    await shouldHappen(() => div.querySelectorAll('.ticl-e-block-selected').length === 0);
    expect(selectedPaths).toEqual([]);
  });

  it('automatic assign xy', async function () {
    flow = Root.instance.addFlow('BlockStage6');
    for (let i = 0; i < 10; ++i) {
      flow.createBlock(`a${i}`);
    }

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage6" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'));
    await shouldHappen(() => (div.querySelector('.ticl-e-block') as HTMLDivElement).offsetLeft > 0);

    const blocks = div.querySelectorAll('.ticl-e-block');
    const xarr = [36, 228, 36, 228, 420, 420, 36, 228, 420, 612];
    const yarr = [36, 36, 228, 228, 36, 228, 420, 420, 420, 36];
    for (let i = 0; i < 10; ++i) {
      const block = blocks[i] as HTMLDivElement;
      expect(block.offsetLeft).toBe(xarr[i]);
      expect(block.offsetTop).toBe(yarr[i]);
    }
  });
});
