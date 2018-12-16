import {assert} from "chai";
import SimulateEvent from "simulate-event";
import React from 'react';
import NodeTree from "../NodeTree";
import {Block, Root} from "../../../common/block/Block";
import "../../../common/functions/basic/Math";
import {makeLocalConnection} from "../../../common/connect/LocalConnection";
import {shouldHappen} from "../../../common/util/test-util";
import ReactDOM from "react-dom";
import {loadTemplate} from "../../../ui/util/test-util";

describe("editor NodeTree", function () {

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
      document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='NodeTree']/../div[1]", div, null, 9, null).singleNodeValue,
      'click');
    await shouldHappen(() => contentDiv.childNodes.length >= 11);

    // find block icon
    await shouldHappen(() => document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='0']/../div[2]/div[contains(@class,'tico-fas-plus')]", div, null, 9, null).singleNodeValue);

    // expand more children
    SimulateEvent.simulate(
      document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='9']/../div[1]", div, null, 9, null).singleNodeValue,
      'click');
    // max children is 20, since 30px per row and total 600px height
    await shouldHappen(() => contentDiv.childNodes.length === 20);


    // expand even more children
    SimulateEvent.simulate(
      document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='8']/../div[1]", div, null, 9, null).singleNodeValue,
      'click');
    // max children is 20
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // increase height, allows more children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '650px';
    await shouldHappen(() => contentDiv.childNodes.length === 22);

    // close some children
    SimulateEvent.simulate(
      document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='8']/../div[1]", div, null, 9, null).singleNodeValue,
      'click');
    await shouldHappen(() => contentDiv.childNodes.length === 21);

    // decrease height, allows less children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '420px';
    await shouldHappen(() => contentDiv.childNodes.length === 14);

    // scroll
    contentDiv.parentElement.scrollTop = 60;
    // root element should disappear
    await shouldHappen(() => document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='NodeTree']", div, null, 9, null).singleNodeValue == null);

    // scroll back
    contentDiv.parentElement.scrollTop = 0;
    // root element is back
    await shouldHappen(() => document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='NodeTree']", div, null, 9, null).singleNodeValue);

    // right click the first node
    SimulateEvent.simulate(
      document.evaluate("//div[contains(@class,'ticl-tree-node-text')][text()='NodeTree']", div, null, 9, null).singleNodeValue,
      'contextmenu');
    // click Reload
    SimulateEvent.simulate(
      document.evaluate("//li[contains(@class,'ant-dropdown-menu-item')][text()='Reload']", document.body, null, 9, null).singleNodeValue,
      'click');
    // second layer of children node should all be closed
    await shouldHappen(() => contentDiv.childNodes.length === 11);

    ReactDOM.unmountComponentAtNode(div);
    client.destroy();
    Root.instance.deleteValue('NodeTree');
  });

});
