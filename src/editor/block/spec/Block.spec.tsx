import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import BlockStage from "../BlockStage";
import {Block, Root} from "../../../common/block/Block";
import "../../../common/functions/basic/Math";
import {makeLocalConnection} from "../../../common/connect/LocalConnection";
import {shouldHappen} from "../../../common/util/test-util";
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
});
