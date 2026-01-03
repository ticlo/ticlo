import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {NodeTree} from '../../index.js';
import type {Block} from '@ticlo/core';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.js';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.js';

describe('editor NodeTree', function () {
  let server: any;
  let client: any;

  afterEach(async function () {
    // Clean up React component first to stop any active watches
    removeLastTemplate();

    // Give React time to fully unmount and clean up
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clean up the flow after component is unmounted
    if (Root.instance.getValue('NodeTree')) {
      Root.instance.deleteValue('NodeTree');
      await shouldHappen(() => !Root.instance.getValue('NodeTree'), 100);
    }

    // Then destroy the connection
    destroyLastLocalConnection();

    server = null;
    client = null;
  });

  function addTestChildren(block: Block, parentname: string, level: number) {
    for (let i = 0; i < 10; ++i) {
      const name = `${parentname}${i}`;
      const child = block.createBlock(name);
      child.setValue('#is', 'add');
      if (level > 0) {
        addTestChildren(child, name, level - 1);
      }
    }
  }

  it('basic', async function () {
    const flow = Root.instance.addFlow('NodeTree');
    addTestChildren(flow, '', 3);

    [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <NodeTree conn={client} basePaths={['NodeTree']} style={{width: '600px', height: '600px'}} />,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ticl-node-tree'));
    await shouldHappen(() => div.querySelector('.ticl-v-scroll-content'));
    const contentDiv = div.querySelector('.ticl-v-scroll-content');
    await shouldHappen(() => contentDiv.childNodes.length >= 1);

    // expand child

    simulate(querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => contentDiv.childNodes.length >= 11);

    // find block icon
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='5']/../div.tico/div.tico-fas-plus", div));

    // expand more children
    simulate(querySingle("//div.ticl-tree-node-text[text()='9']/../../div.ticl-tree-arr", div), 'click');
    // max children is 20, since 30px per row and total 600px height
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // expand even more children
    simulate(querySingle("//div.ticl-tree-node-text[text()='8']/../../div.ticl-tree-arr", div), 'click');
    // max children is 20
    await shouldHappen(() => contentDiv.childNodes.length === 20);

    // increase height, allows more children
    (document.querySelector('div.ticl-node-tree') as HTMLDivElement).style.height = '650px';
    await shouldHappen(() => contentDiv.childNodes.length === 22);

    // close some children
    simulate(querySingle("//div.ticl-tree-node-text[text()='8']/../../div.ticl-tree-arr", div), 'click');
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
    simulate(querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => contentDiv.childNodes.length === 1);

    // reopen it, should still show cached nodes
    simulate(querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => contentDiv.childNodes.length === 14);
    // node is removed
    expect(querySingle("//div.ticl-tree-node-text[text()='5']")).toBeNull();

    // Test is complete, no additional cleanup needed here
    // The flow will be cleaned up in afterEach
  });
});
