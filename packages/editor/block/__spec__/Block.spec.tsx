import {expect} from 'vitest';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage';
import {Block, Root, Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util';
import {removeLastTemplate, loadTemplate, querySingle, fakeMouseEvent} from '../../util/test-util';
import {initEditor} from '../../index';
import {arrayEqual} from '@ticlo/core';

describe('editor BlockStage', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('single block', async function () {
    let flow = Root.instance.addFlow('BlockStage1');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '1': 2,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage1" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block'), 500, 'find block');

    let block = div.querySelector('.ticl-block') as HTMLDivElement;
    expect(block.offsetLeft).toBe(123);
    expect(block.offsetTop).toBe(234);
    expect(block.offsetWidth).toBe(345);

    // test all fields in the block body
    await shouldHappen(
      () => querySingle("//div.ticl-field-name/span[text()='0']/..//../../div.ticl-field-value[text()='1']", div),
      100,
      'find field 1'
    );
    expect(
      querySingle("//div.ticl-field-name/span[text()='1']/..//../../div.ticl-field-value[text()='2']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-field-name/span[text()='#output']/..//../../div.ticl-field-value[text()='3']", div)
    ).not.toBeNull();

    // check block icon
    expect(querySingle('//div.tico-icon-svg.tico-fas-plus', div)).not.toBeNull();

    // test value update
    flow.queryProperty('add.0').updateValue(5);
    await shouldHappen(
      () => querySingle("//div.ticl-field-name/span[text()='0']/..//../../div.ticl-field-value[text()='5']", div),
      100,
      'find field 5'
    );
    expect(
      querySingle("//div.ticl-field-name/span[text()='#output']/..//../../div.ticl-field-value[text()='7']", div)
    ).not.toBeNull();

    // test change type
    flow.queryProperty('add.#is').setValue('subtract');
    await shouldHappen(
      () => querySingle("//div.ticl-field-name/span[text()='#output']/..//../../div.ticl-field-value[text()='3']", div),
      100,
      'find field 3'
    );
    // check block icon again
    expect(querySingle('//div.tico-icon-svg.tico-fas-minus', div)).not.toBeNull();

    Root.instance.deleteValue('BlockStage1');
  });

  it('drag block', async function () {
    let flow = Root.instance.addFlow('BlockStage2');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage2" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let block = div.querySelector('.ticl-stage-scroll .ticl-block') as HTMLDivElement;
    // mouse down
    SimulateEvent.simulate(document.querySelector('.ticl-stage-scroll .ticl-block-head'), 'mousedown', {
      clientX: 0,
      clientY: 0,
    });

    await shouldHappen(() => block.classList.contains('ticl-block-selected'));

    // mouse move to drag
    expect(block.offsetLeft).toBe(123);
    expect(block.offsetTop).toBe(234);
    SimulateEvent.simulate(document.body, 'mousemove', {
      clientX: 100,
      clientY: 100,
    });
    await shouldHappen(() => block.offsetLeft === 223);
    expect(block.offsetTop).toBe(334);

    // mouse up to stop dragging
    SimulateEvent.simulate(document.body, 'mouseup');

    await shouldHappen(() => arrayEqual((flow as Flow).queryValue('add.@b-xyw') as unknown[], [223, 334, 345]));

    // mouse move no longer drag block
    SimulateEvent.simulate(document.body, 'mousemove', {
      clientX: 200,
      clientY: 200,
    });
    await shouldReject(shouldHappen(() => block.offsetLeft !== 223));

    Root.instance.deleteValue('BlockStage2');
  });

  it('drag block size', async function () {
    let flow = Root.instance.addFlow('BlockStage3');
    flow.load({
      add: {
        '#is': 'add',
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', '#output'],
      },
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage3" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let block = div.querySelector('.ticl-stage-scroll .ticl-block') as HTMLDivElement;
    await shouldHappen(() => block.offsetWidth === 345);
    // mouse down
    SimulateEvent.simulate(document.querySelector('.ticl-width-drag'), 'mousedown', fakeMouseEvent());

    // mouse move to trigger drag start
    SimulateEvent.simulate(document.body, 'mousemove', fakeMouseEvent(100, 100));
    // mouse move to trigger drag move
    SimulateEvent.simulate(document.body, 'mousemove', fakeMouseEvent(100, 100));

    await shouldHappen(() => block.offsetWidth === 445);

    await shouldHappen(() => arrayEqual((flow as Flow).queryValue('add.@b-xyw') as unknown[], [123, 234, 445]));

    // mouse up to stop dragging
    SimulateEvent.simulate(document.body, 'mouseup');

    Root.instance.deleteValue('BlockStage3');
  });

  it('min block and wire', async function () {
    let flow = Root.instance.addFlow('BlockStage4');
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

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage4" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    // wait for the wire
    await shouldHappen(() => div.querySelector('svg.ticl-block-wire'));

    let addBlock = querySingle("//div.ticl-block-head.ticl-block-head-label[text()='add']/../..", div);
    expect(addBlock.offsetWidth).toBe(143);

    let wire = div.querySelector('svg.ticl-block-wire') as SVGSVGElement;

    // mousedown to select
    SimulateEvent.simulate(addBlock.querySelector('.ticl-stage-scroll .ticl-block-head'), 'mousedown');
    SimulateEvent.simulate(document.body, 'mouseup');
    // wire should have z index
    await shouldHappen(() => wire.style.zIndex === '100');

    // minimize the block
    SimulateEvent.simulate(addBlock.querySelector('.ticl-block-head'), 'dblclick');
    await shouldHappen(() => addBlock.offsetWidth === 24);
    expect(addBlock.offsetHeight).toBe(24);

    // wrie instance should be reused
    expect(div.querySelector('svg')).toBe(wire);

    // click the other block
    SimulateEvent.simulate(
      querySingle("//div.ticl-block-head.ticl-block-head-label[text()='subtract']/..", div),
      'mousedown'
    );
    // addBlock is no longer selected
    await shouldHappen(() => !addBlock.classList.contains('ticl-block-selected'));
    // since subtract block is now selected, wire should still have zindex
    expect(wire.style.zIndex).toBe('100');

    // expand block
    SimulateEvent.simulate(addBlock.querySelector('.ticl-block-head'), 'dblclick');
    await shouldHappen(() => addBlock.offsetWidth === 143);

    // wire should disappear when source not in stage
    flow.queryProperty('subtract.0').setBinding('##.unknown');
    await shouldHappen(() => div.querySelector('svg.ticl-block-wire') == null);

    // wire should be back when binding is set again
    flow.queryProperty('subtract.0').setBinding('##.add.1');
    await shouldHappen(() => div.querySelector('svg.ticl-block-wire'));

    // wire should disappear when unbound
    flow.queryProperty('subtract.0').setValue(1);
    await shouldHappen(() => div.querySelector('svg.ticl-block-wire') == null);

    Root.instance.deleteValue('BlockStage4');
  });

  it('rect select', async function () {
    let flow = Root.instance.addFlow('BlockStage5');
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

    let [server, client] = makeLocalConnection(Root.instance);

    let selectedPaths: string[];

    function onSelect(paths: string[]) {
      selectedPaths = paths;
    }

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage5" onSelect={onSelect} style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    // wait for the field
    await shouldHappen(() => (div.querySelector('.ticl-stage-bg') as HTMLElement)?.offsetWidth);
    // background
    let rectBg = div.querySelector('.ticl-stage-bg');

    // select all
    SimulateEvent.simulate(rectBg, 'mousedown', fakeMouseEvent(90, 90));
    SimulateEvent.simulate(rectBg, 'mouseup', fakeMouseEvent(310, 310));

    // both block are selected
    await shouldHappen(() => div.querySelectorAll('.ticl-stage-scroll .ticl-block-selected').length === 2);
    expect(selectedPaths).toEqual(['BlockStage5.add', 'BlockStage5.subtract']);

    // select all
    SimulateEvent.simulate(rectBg, 'mousedown', fakeMouseEvent(210, 210));
    SimulateEvent.simulate(rectBg, 'mouseup', fakeMouseEvent(90, 90));

    // one block selected
    await shouldHappen(() => div.querySelectorAll('.ticl-stage-scroll .ticl-block-selected').length === 1);
    expect(selectedPaths).toEqual(['BlockStage5.add']);

    // select none
    // select all
    SimulateEvent.simulate(rectBg, 'mousedown', fakeMouseEvent(90, 90));
    SimulateEvent.simulate(rectBg, 'mouseup', fakeMouseEvent(91, 89));

    // one block selected
    await shouldHappen(() => div.querySelectorAll('.ticl-block-selected').length === 0);
    expect(selectedPaths).toEqual([]);

    Root.instance.deleteValue('BlockStage5');
  });

  it('automatic assign xy', async function () {
    let flow = Root.instance.addFlow('BlockStage6');
    for (let i = 0; i < 10; ++i) {
      flow.createBlock(`a${i}`);
    }

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage6" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block'));
    await shouldHappen(() => (div.querySelector('.ticl-block') as HTMLDivElement).offsetLeft > 0);

    let blocks = div.querySelectorAll('.ticl-block');
    let xarr = [36, 228, 36, 228, 420, 420, 36, 228, 420, 612];
    let yarr = [36, 36, 228, 228, 36, 228, 420, 420, 420, 36];
    for (let i = 0; i < 10; ++i) {
      let block = blocks[i] as HTMLDivElement;
      expect(block.offsetLeft).toBe(xarr[i]);
      expect(block.offsetTop).toBe(yarr[i]);
    }
    Root.instance.deleteValue('BlockStage6');
  });
});
