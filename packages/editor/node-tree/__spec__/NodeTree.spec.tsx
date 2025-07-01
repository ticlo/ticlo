import {expect} from 'vitest';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {NodeTree} from '../../index';
import {Block, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {shouldHappen} from '@ticlo/core/util/test-util';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util';

describe('editor NodeTree', function () {
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
    let flow = Root.instance.addFlow('NodeTree');
    addTestChildren(flow, '', 3);

    let [server, client] = makeLocalConnection(Root.instance);

    let [component, div] = loadTemplate(
      <NodeTree conn={client} basePaths={['NodeTree']} style={{width: '600px', height: '600px'}} />,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ticl-node-tree'));
    await shouldHappen(() => div.querySelector('.ticl-v-scroll-content'));
    let contentDiv = div.querySelector('.ticl-v-scroll-content');
    await shouldHappen(() => contentDiv.childNodes.length >= 1);

    // expand child

    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div),
      'click'
    );
    await shouldHappen(() => contentDiv.childNodes.length >= 11);

    // find block icon
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='5']/../div.tico/div.tico-fas-plus", div));

    // expand more children
    SimulateEvent.simulate(querySingle("//div.ticl-tree-node-text[text()='9']/../../div.ticl-tree-arr", div), 'click');
    // max children is 20, since 30px per row and total 600px height
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // expand even more children
    SimulateEvent.simulate(querySingle("//div.ticl-tree-node-text[text()='8']/../../div.ticl-tree-arr", div), 'click');
    // max children is 20
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // increase height, allows more children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '650px';
    await shouldHappen(() => contentDiv.childNodes.length === 22);

    // close some children
    SimulateEvent.simulate(querySingle("//div.ticl-tree-node-text[text()='8']/../../div.ticl-tree-arr", div), 'click');
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
    flow.setValue('5', undefined);

    // close children
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div),
      'click'
    );
    await shouldHappen(() => contentDiv.childNodes.length === 1);

    // reopen it, should still show cached nodes
    SimulateEvent.simulate(
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div),
      'click'
    );
    await shouldHappen(() => contentDiv.childNodes.length === 14);
    // node is removed
    expect(querySingle("//div.ticl-tree-node-text[text()='5']")).toBeNull();

    Root.instance.deleteValue('NodeTree');
  });
});
