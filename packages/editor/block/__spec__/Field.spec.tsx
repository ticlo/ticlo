import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {type Flow, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';
import {initEditor} from '../../index.ts';

describe('editor Block Field', function () {
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
    flow = Root.instance.addFlow('BlockField1');
    flow.load({
      add: {
        '#is': '',
        'a': 1,
        'b': 1.333333333333,
        'c': 'ccc',
        'd': true,
        'e': null,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['a', 'b', 'c', 'd', 'e', 'z'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField1" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-field'), 1000, 'find fields');

    const block = div.querySelector('.ticl-e-block') as HTMLDivElement;

    await shouldHappen(() => block.querySelectorAll('.ticl-e-field').length === 6);

    await shouldHappen(() =>
      querySingle("//div.ticl-e-field-name/span[text()='a']/..//../../div.ticl-e-field-value[text()='1']", div)
    );
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='b']/..//../../div.ticl-e-field-value[text()='1.333']", div)
    ).not.toBeNull();
    expect(
      querySingle(
        "//div.ticl-e-field-name/span[text()='c']/..//../../div.ticl-e-field-value/span.ticl-e-string-value[text()='ccc']",
        div
      )
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='d']/..//../../div.ticl-e-field-value[text()='true']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='e']/..//../../div.ticl-e-field-value[text()='null']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='z']/..//../../div.ticl-e-field-value[not(text())]", div)
    ).not.toBeNull();

    flow.queryProperty('add.c').setValue(3);
    // no longer a string value
    await shouldHappen(() =>
      querySingle(
        "//div.ticl-e-field-name/span[text()='c']/..//../../div.ticl-e-field-value[text()='3'][not(contains(@class,'ticl-e-string-value'))]",
        div
      )
    );
  });

  it('sub block', async function () {
    flow = Root.instance.addFlow('BlockField2');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
      subtract: {
        '#is': 'subtract',
        '~0': {
          '#is': 'add',
          '0': 1,
          '~1': '##.##.add.0',
          '@b-p': ['0', '1'],
        },
        '@b-xyw': [120, 280, 143],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField2" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'));

    const subtractBlock = querySingle("//div.ticl-e-block-head.ticl-e-block-head-label[text()='subtract']/../..", div);

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 3);

    const fieldNames = subtractBlock.querySelectorAll('.ticl-e-field-name');
    expect(fieldNames[0].textContent).toBe('0');
    // property from sub blocks
    expect(fieldNames[1].textContent).toBe('0');
    expect(fieldNames[2].textContent).toBe('1');

    // hide sub block
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 1);
    // wire should still exists
    expect(document.querySelector('svg')).not.toBeNull();

    // show sub block again
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 3);
  });

  it.each(['mousedown', 'mouseup'])('opens a field menu on release when contextmenu follows %s', async (timing) => {
    const flow = Root.instance.addFlow('BlockFieldMenu');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
    });
    const [server, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<BlockStage conn={client} basePath="BlockFieldMenu" />, 'editor');

    try {
      const fieldName = await shouldHappen(() => div.querySelector('.ticl-e-field-name > span'));
      const mouse = {button: 2, clientX: 150, clientY: 140};
      simulate(fieldName, 'mousedown', {...mouse, buttons: 2});
      if (timing === 'mousedown') simulate(fieldName, 'contextmenu', mouse);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
      simulate(fieldName, 'mouseup', mouse);
      if (timing === 'mouseup') simulate(fieldName, 'contextmenu', mouse);

      const menu = await shouldHappen(() => document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)'));
      expect(menu.textContent).toContain('Binding');
      expect(menu.textContent).toContain('Pinned');
      expect(div.querySelector('.ticl-e-block')).not.toBeNull();

      simulate(document.body, 'keydown', {key: 'Escape'});
      await shouldHappen(() => !document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)'));
      expect(div.querySelector('.ticl-e-block')).not.toBeNull();
    } finally {
      Root.instance.deleteValue('BlockFieldMenu');
    }
  });

  it('reorders fields with the right button without opening a menu', async () => {
    const flow = Root.instance.addFlow('BlockFieldReorderMenu', {
      block: {'#is': '', 'a': 1, 'b': 2, '@b-xyw': [100, 100, 200], '@b-p': ['a', 'b']},
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<BlockStage conn={client} basePath="BlockFieldReorderMenu" />, 'editor');
    try {
      await shouldHappen(() => div.querySelectorAll('.ticl-e-field-name > span').length === 2);
      const [source, target] = div.querySelectorAll('.ticl-e-field-name > span');
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const down = {button: 2, buttons: 2, clientX: from.x + from.width / 2, clientY: from.y + from.height / 2};
      const move = {button: 2, buttons: 2, clientX: to.x + to.width / 2, clientY: to.y + to.height / 2};
      simulate(source, 'mousedown', down);
      simulate(source, 'contextmenu', down);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
      simulate(target, 'mousemove', move);
      expect(document.querySelector('.ticl-e-drag-wire')).toBeNull();
      simulate(target, 'mouseup', {...move, buttons: 0});
      simulate(target, 'contextmenu', {...move, buttons: 0});
      await shouldHappen(() => (flow.queryValue('block.@b-p') as string[])[0] === 'b');
      // Wait for the reorder response before tearing down the connection.
      await client.getValue('BlockFieldReorderMenu.block.@b-p');
      expect(flow.queryValue('block.@b-p')).toEqual(['b', 'a']);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
    } finally {
      Root.instance.deleteValue('BlockFieldReorderMenu');
    }
  });

  it('indirect binding', async function () {
    flow = Root.instance.addFlow('BlockField3');
    flow.load({
      add: {
        '#is': 'add',
        '0': {a: 3},
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
      subtract: {
        '#is': 'subtract',
        '~0': '##.add.0.a',
        '@b-xyw': [260, 124, 143],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField3" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));

    const wire = div.querySelector('.ticl-e-block-wire');

    // indirect binding should have dash style
    expect(wire.classList.contains('ticl-e-wire-dash')).toBe(true);

    // switch to direct binding
    flow.queryProperty('subtract.0').setBinding('##.add.0');

    await shouldHappen(() => !wire.classList.contains('ticl-e-wire-dash'));
  });
});
