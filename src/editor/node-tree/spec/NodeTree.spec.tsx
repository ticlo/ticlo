import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import {NodeTree} from "../../../editor";
import {Block, Root} from "../../../core";
import {destroyLastLocalConnection, makeLocalConnection} from "../../../core/connect/LocalConnection";
import {shouldHappen} from "../../../core/util/test-util";
import ReactDOM from "react-dom";
import {removeLastTemplate, loadTemplate, querySingle} from "../../../ui/util/test-util";

describe("editor NodeTree", function () {

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });


  function addTestChildren(block: Block, parentname: string, level: number) {
    for (let i = 0; i < 10; ++i) {
      let name = `${parentname}${i}`;
      let child = block.createBlock(name);
      child.setValue('#is', 'add');
      if (level > 0) {
        addTestChildren(child, name, level - 1);
      }
    }
  }

  it('basic', async function () {

    let job = Root.instance.addJob('NodeTree');
    addTestChildren(job, '', 3);

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <NodeTree
        conn={client}
        basePath="NodeTree"
        style={{width: '600px', height: '600px'}}
      />, 'editor');
    await shouldHappen(() => div.querySelector('.ticl-v-scroll-content'));
    let contentDiv = div.querySelector('.ticl-v-scroll-content');
    await shouldHappen(() => contentDiv.childNodes.length >= 1);

    // expand child

    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../div.ticl-tree-arr", div),
      'click');
    await shouldHappen(() => contentDiv.childNodes.length >= 11);

    // find block icon
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='5']/../div.tico.tico-pr0/div.tico-fas-plus", div));

    // expand more children
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='9']/../div.ticl-tree-arr", div),
      'click');
    // max children is 20, since 30px per row and total 600px height
    await shouldHappen(() => contentDiv.childNodes.length === 20);


    // expand even more children
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='8']/../div.ticl-tree-arr", div),
      'click');
    // max children is 20
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // increase height, allows more children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '650px';
    await shouldHappen(() => contentDiv.childNodes.length === 22);

    // close some children
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='8']/../div.ticl-tree-arr", div),
      'click');
    await shouldHappen(() => contentDiv.childNodes.length === 21);

    // decrease height, allows less children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '420px';
    await shouldHappen(() => contentDiv.childNodes.length === 14);

    // scroll
    contentDiv.parentElement.scrollTop = 60;
    // root element should disappear
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='NodeTree']", div) == null);

    // scroll back
    contentDiv.parentElement.scrollTop = 0;
    // root element is back
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='NodeTree']", div));

    // remove one child block
    job.setValue('5', undefined);

    // close children
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../div.ticl-tree-arr", div),
      'click');
    await shouldHappen(() => contentDiv.childNodes.length === 1);

    // reopen it, should still show cached nodes
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../div.ticl-tree-arr", div),
      'click');
    await shouldHappen(() => contentDiv.childNodes.length === 14);
    // node is removed but cache still exists
    assert.isNotNull(querySingle("//div.ticl-tree-node-text[text()='5']"));
    // find block icon should disappear, because #is changed to blank
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='5']/../div.tico/div", div) == null);

    // right click the first node
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']", div),
      'contextmenu');
    // click Reload
    SimulateEvent.simulate(
      querySingle("//li[contains(@class,'ant-dropdown-menu-item')][text()='Reload']"),
      'click');
    // second layer of children node should all be closed
    await shouldHappen(() => contentDiv.childNodes.length === 10);
    // children should be refreshed, only 9 children remain
    assert.isNull(querySingle("//div.ticl-tree-node-text[text()='5']"));

    Root.instance.deleteValue('NodeTree');
  });

});
