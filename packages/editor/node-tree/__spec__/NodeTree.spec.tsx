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

  function getVisibleNodeNames(div: HTMLElement) {
    return Array.from(div.querySelectorAll('.ticl-tree-node-text')).map((node) => node.textContent);
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

  it('uses #order config for child order', async function () {
    const flow = Root.instance.addFlow('NodeTree');
    addTestChildren(flow, '', 1);

    [server, client] = makeLocalConnection(Root.instance);

    const [, div] = loadTemplate(
      <NodeTree conn={client} basePaths={['NodeTree']} style={{width: '600px', height: '900px'}} />,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ticl-node-tree'));
    await shouldHappen(() => div.querySelector('.ticl-v-scroll-content'));
    const contentDiv = div.querySelector('.ticl-v-scroll-content');
    await shouldHappen(() => contentDiv.childNodes.length >= 1);

    simulate(querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => contentDiv.childNodes.length >= 11);
    expect(getVisibleNodeNames(div).slice(0, 5)).toEqual(['NodeTree', '0', '1', '2', '3']);

    flow.setValue('#order', ['0']);
    await shouldHappen(() =>
      querySingle("//div.ticl-tree-node-text[text()='0']/../..", div).classList.contains('ticl-tree-node-ordered')
    );

    flow.setValue('#order', ['9', '2', 5, 'missing', '4']);
    await shouldHappen(() => getVisibleNodeNames(div).slice(0, 5).join(',') === 'NodeTree,9,2,4,0');
    expect(querySingle("//div.ticl-tree-node-text[text()='9']/../..", div).classList).toContain(
      'ticl-tree-node-ordered'
    );
    expect(querySingle("//div.ticl-tree-node-text[text()='2']/../..", div).classList).toContain(
      'ticl-tree-node-ordered'
    );
    expect(querySingle("//div.ticl-tree-node-text[text()='0']/../..", div).classList).not.toContain(
      'ticl-tree-node-ordered'
    );

    simulate(querySingle("//div.ticl-tree-node-text[text()='2']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => getVisibleNodeNames(div).slice(0, 8).join(',') === 'NodeTree,9,2,20,21,22,23,24');

    (flow.getValue('2') as Block).setValue('#order', ['29', '21']);
    await shouldHappen(() => getVisibleNodeNames(div).slice(0, 8).join(',') === 'NodeTree,9,2,29,21,20,22,23');
    expect(querySingle("//div.ticl-tree-node-text[text()='29']/../..", div).classList).toContain(
      'ticl-tree-node-ordered'
    );
  });
});
