import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import BlockStage from "../BlockStage";
import {Block, Root} from "../../../common/block/Block";
import "../../../common/functions/basic/Math";
import {destroyLastLocalConnection, makeLocalConnection} from "../../../common/connect/LocalConnection";
import {shouldHappen, shouldReject} from "../../../common/util/test-util";
import ReactDOM from "react-dom";
import {removeLastTemplate, loadTemplate, querySingle} from "../../../ui/util/test-util";
import {initEditor} from "../../index";
import {arrayEqual} from "../../../common/util/Compare";

describe("editor Block Field", function () {

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('single block', async function () {

    await initEditor();
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
});
