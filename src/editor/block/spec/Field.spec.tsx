import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {BlockStage} from "../../../editor";
import {Block, Root} from "../../../core/main";
import {destroyLastLocalConnection, makeLocalConnection} from "../../../core/connect/LocalConnection";
import {shouldHappen, shouldReject} from "../../../core/util/test-util";
import ReactDOM from "react-dom";
import {removeLastTemplate, loadTemplate, querySingle} from "../../../ui/util/test-util";
import {initEditor} from "../../index";
import {arrayEqual} from "../../../core/util/Compare";

describe("editor Block Field", function () {

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('single block', async function () {

    let job = Root.instance.addJob('BlockField1');
    job.load({
      add: {
        '#is': '',
        'a': 1,
        'b': 1.333333333333,
        'c': 'ccc',
        'd': true,
        'e': null,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['a', 'b', 'c', 'd', 'e', 'z']
      }
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField1"
                  style={{width: '800px', height: '800px'}}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-field'));

    let block = div.querySelector('.ticl-block') as HTMLDivElement;

    await shouldHappen(() => block.querySelectorAll('.ticl-field').length === 6);

    await shouldHappen(() => querySingle("//div.ticl-field-name[text()='a']/../div.ticl-field-value/span[text()='1']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='b']/../div.ticl-field-value/span[text()='1.333']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='c']/../div.ticl-field-value/span.ticl-string-value[text()='ccc']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='d']/../div.ticl-field-value/span[text()='true']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='e']/../div.ticl-field-value/span[text()='null']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='z']/../div.ticl-field-value/span[not(text())]", div));

    job.queryProperty('add.c').setValue(3);
    // no longer a string value
    await shouldHappen(() => querySingle("//div.ticl-field-name[text()='c']/../div.ticl-field-value/span[text()='3'][not(contains(@class,'ticl-string-value'))]", div));

    Root.instance.deleteValue('BlockField1');
  });


  it('sub block', async function () {

    let job = Root.instance.addJob('BlockField2');
    job.load({
      add: {
        '#is': 'add',
        '0': 1,
        '@b-xyw': [100, 100, 150],
        '@b-p': ['0']
      },
      subtract: {
        '#is': 'subtract',
        '~0': {
          '#is': 'add',
          '0': 1,
          '~1': '##.##.add.0',
          '@b-p': ['0', '1']
        },
        '@b-xyw': [120, 280, 150],
        '@b-p': ['0']
      },
    });


    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField2"
                  style={{width: '800px', height: '800px'}}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let subtractBlock = querySingle("//div.ticl-block-head[text()='subtract']/..", div);

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 3);

    let fieldNames = subtractBlock.querySelectorAll('.ticl-field-name');
    assert.equal(fieldNames[0].textContent, '0');
    // property from sub blocks
    assert.equal(fieldNames[1].textContent, '0');
    assert.equal(fieldNames[2].textContent, '1');

    // hide sub block
    SimulateEvent.simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 1);
    // wire should still exists
    assert.isNotNull(document.querySelector('svg'));

    // show sub block again
    SimulateEvent.simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-field').length === 3);

    Root.instance.deleteValue('BlockField2');
  });

  it('indirect binding', async function () {

    let job = Root.instance.addJob('BlockField3');
    job.load({
      add: {
        '#is': 'add',
        '0': {'a': 3},
        '@b-xyw': [100, 100, 150],
        '@b-p': ['0']
      },
      subtract: {
        '#is': 'subtract',
        '~0': '##.add.0.a',
        '@b-xyw': [260, 124, 150],
        '@b-p': ['0']
      },
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField3"
                  style={{width: '800px', height: '800px'}}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-block-wire'));

    let wire = div.querySelector('.ticl-block-wire');

    // indirect binding should have dash style
    assert.isTrue(wire.classList.contains('ticl-wire-dash'));

    // switch to direct binding
    job.queryProperty('subtract.0').setBinding('##.add.0');

    await shouldHappen(() => !wire.classList.contains('ticl-wire-dash'));

    Root.instance.deleteValue('BlockField3');
  });

});
