import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import BlockStage from "../BlockStage";
import {Block, Root} from "../../../common/block/Block";
import "../../../common/functions/basic/Math";
import {makeLocalConnection} from "../../../common/connect/LocalConnection";
import {shouldHappen, shouldReject} from "../../../common/util/test-util";
import ReactDOM from "react-dom";
import {loadTemplate, querySingle} from "../../../ui/util/test-util";
import {initEditor} from "../../index";

describe("editor BlockStage", function () {

  it('single block', async function () {

    await initEditor();
    let job = Root.instance.addJob('BlockStage1');
    job.load({
      add: {
        '#is': 'add',
        '0': 1,
        '1': 2,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', 'output']
      }
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage1"
                  style={{width: '800px', height: '800px'}}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let block = div.querySelector('.ticl-block') as HTMLDivElement;
    assert.equal(block.offsetLeft, 123);
    assert.equal(block.offsetTop, 234);
    assert.equal(block.offsetWidth, 345);

    // test all fields in the block body
    await shouldHappen(() => querySingle("//div.ticl-field-name[text()='0']/../div.ticl-field-value/span[text()='1']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='1']/../div.ticl-field-value/span[text()='2']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='output']/../div.ticl-field-value/span[text()='3']", div));

    // check block icon
    assert.isNotNull(querySingle("//div.tico-icon-svg.tico-fas-plus", div));

    // test value update
    job.queryProperty('add.0').updateValue(5);
    await shouldHappen(() => querySingle("//div.ticl-field-name[text()='0']/../div.ticl-field-value/span[text()='5']", div));
    assert.isNotNull(querySingle("//div.ticl-field-name[text()='output']/../div.ticl-field-value/span[text()='7']", div));

    // test change type
    job.queryProperty('add.#is').setValue('subtract');
    await shouldHappen(() => querySingle("//div.ticl-field-name[text()='output']/../div.ticl-field-value/span[text()='3']", div));
    // check block icon again
    assert.isNotNull(querySingle("//div.tico-icon-svg.tico-fas-minus", div));

    ReactDOM.unmountComponentAtNode(div);
    client.destroy();
    Root.instance.deleteValue('BlockStage1');
  });

  it('drag block', async function () {
    await initEditor();
    let job = Root.instance.addJob('BlockStage2');
    job.load({
      add: {
        '#is': 'add',
        '@b-xyw': [123, 234, 345],
        '@b-p': ['0', '1', 'output']
      }
    });

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockStage2"
                  style={{width: '800px', height: '800px'}}/>, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-block'));

    let block = div.querySelector('.ticl-block') as HTMLDivElement;
    // mouse down
    SimulateEvent.simulate(document.querySelector('.ticl-block-head'), 'pointerdown', {
      clientX: 0,
      clientY: 0,
    });

    await shouldHappen(() => block.classList.contains('ticl-block-selected'));

    // mouse move to drag
    assert.equal(block.offsetLeft, 123);
    assert.equal(block.offsetTop, 234);
    SimulateEvent.simulate(document.body, 'mousemove', {
      clientX: 100,
      clientY: 100
    });
    await shouldHappen(() => block.offsetLeft === 223);
    assert.equal(block.offsetTop, 334);

    // mouse up to stop dragging
    SimulateEvent.simulate(document.body, 'mouseup');

    // mouse move no longer drag block
    SimulateEvent.simulate(document.body, 'mousemove', {
      clientX: 200,
      clientY: 200
    });
    await shouldReject(shouldHappen(() => block.offsetLeft !== 223));

    ReactDOM.unmountComponentAtNode(div);
    client.destroy();
    Root.instance.deleteValue('BlockStage2');
  });
});
