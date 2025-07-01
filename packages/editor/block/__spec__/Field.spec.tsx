import {expect} from 'vitest';
import { simulate } from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage';
import {Block, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util';
import {initEditor} from '../../index';

describe('editor Block Field', function () {
  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('single block', async function () {
    let flow = Root.instance.addFlow('BlockField1');
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

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField1" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-field'));

    let block = div.querySelector('.ticl-block') as HTMLDivElement;

    await shouldHappen(() => block.querySelectorAll('.ticl-field').length === 6);

    await shouldHappen(() =>
      querySingle("//div.ticl-field-name/span[text()='a']/..//../../div.ticl-field-value[text()='1']", div)
    );
    expect(
      querySingle("//div.ticl-field-name/span[text()='b']/..//../../div.ticl-field-value[text()='1.333']", div)
    ).not.toBeNull();
    expect(
      querySingle(
        "//div.ticl-field-name/span[text()='c']/..//../../div.ticl-field-value/span.ticl-string-value[text()='ccc']",
        div
      )
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-field-name/span[text()='d']/..//../../div.ticl-field-value[text()='true']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-field-name/span[text()='e']/..//../../div.ticl-field-value[text()='null']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-field-name/span[text()='z']/..//../../div.ticl-field-value[not(text())]", div)
    ).not.toBeNull();

    flow.queryProperty('add.c').setValue(3);
    // no longer a string value
    await shouldHappen(() =>
      querySingle(
        "//div.ticl-field-name/span[text()='c']/..//../../div.ticl-field-value[text()='3'][not(contains(@class,'ticl-string-value'))]",
        div
      )
    );

    Root.instance.deleteValue('BlockField1');
  });

  it('sub block', async function () {
    let flow = Root.instance.addFlow('BlockField2');
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

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField2" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let subtractBlock = querySingle("//div.ticl-block-head.ticl-block-head-label[text()='subtract']/../..", div);

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 3);

    let fieldNames = subtractBlock.querySelectorAll('.ticl-field-name');
    expect(fieldNames[0].textContent).toBe('0');
    // property from sub blocks
    expect(fieldNames[1].textContent).toBe('0');
    expect(fieldNames[2].textContent).toBe('1');

    // hide sub block
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 1);
    // wire should still exists
    expect(document.querySelector('svg')).not.toBeNull();

    // show sub block again
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 3);

    Root.instance.deleteValue('BlockField2');
  });

  it('indirect binding', async function () {
    let flow = Root.instance.addFlow('BlockField3');
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

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField3" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-block-wire'));

    let wire = div.querySelector('.ticl-block-wire');

    // indirect binding should have dash style
    expect(wire.classList.contains('ticl-wire-dash')).toBe(true);

    // switch to direct binding
    flow.queryProperty('subtract.0').setBinding('##.add.0');

    await shouldHappen(() => !wire.classList.contains('ticl-wire-dash'));

    Root.instance.deleteValue('BlockField3');
  });
});
