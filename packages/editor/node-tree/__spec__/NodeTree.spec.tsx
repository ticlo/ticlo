import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage, NodeTree, initEditor} from '../../index.ts';
import type {Block} from '@ticlo/core';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';

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

  it.each([true, false])('keeps icons on first expansion with serialize=%s', async function (serialize) {
    Root.instance.addFlow('NodeTree', {child: {'#is': 'add', '@b-xyw': [0, 0, 150]}});
    [server, client] = makeLocalConnection(Root.instance, true, undefined, serialize);
    let tree: NodeTree;
    const [, div] = loadTemplate(
      <>
        <BlockStage conn={client} basePath="NodeTree" style={{width: 600, height: 300}} />
        <NodeTree
          ref={(value) => {
            tree = value;
          }}
          conn={client}
          basePaths={['NodeTree']}
          style={{width: 600, height: 300}}
        />
      </>,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ticl-block .tico-fas-plus'));
    const expand = await shouldHappen(() =>
      querySingle("//div.ticl-tree-node-text[text()='NodeTree']/../../div.ticl-tree-arr", div)
    );
    simulate(expand, 'click');
    await shouldHappen(() => tree.list.find((item) => item.name === 'child')?.funcLib);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const row = querySingle("//div.ticl-tree-node-text[text()='child']/..", div);
    expect(row.querySelector('.tico-fas-plus')).not.toBeNull();
    expect(row.querySelector('.tico-fas-question')).toBeNull();
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

    simulate(querySingle("//div.ticl-tree-node-text[text()='2']/../../div.ticl-tree-arr", div), 'click');
    await shouldHappen(() => getVisibleNodeNames(div).slice(0, 8).join(',') === 'NodeTree,0,1,2,20,21,22,23');

    (flow.getValue('2') as Block).setValue('#order', ['29', '21']);
    await shouldHappen(() => getVisibleNodeNames(div).slice(0, 8).join(',') === 'NodeTree,0,1,2,29,21,20,22');
    expect(querySingle("//div.ticl-tree-node-text[text()='29']/../..", div).classList).toContain(
      'ticl-tree-node-ordered'
    );
  });

  it('removes an ordered child through the node context menu', async () => {
    await initEditor();
    const flow = Root.instance.addFlow('NodeTree', {
      '#order': ['a', 'b', 'missing'],
      'a': {'#is': 'add'},
      'b': {'#is': 'add'},
    });
    [server, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <NodeTree conn={client} basePaths={['NodeTree']} hideRoot style={{width: 600, height: 600}} />,
      'editor'
    );
    const node = await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='a']/..", div));
    await shouldHappen(() => node.querySelector('.tico-fas-plus'));
    simulate(node, 'contextmenu', {button: 2, clientX: 50, clientY: 15});
    const menu = (await shouldHappen(() =>
      document.querySelector('.ticl-dropdown:not(.ticl-dropdown-hidden)')
    )) as HTMLElement;
    const remove = Array.from(menu.querySelectorAll('.ticl-dropdown-menu-item')).find(
      (item) => item.textContent === 'Delete'
    );
    expect(remove).toBeDefined();
    simulate(remove, 'click');
    await shouldHappen(() => flow.getValue('a') === undefined);
    expect(flow.getValue('#order')).toEqual(['b', 'missing']);
    await shouldHappen(() => !querySingle("//div.ticl-tree-node-text[text()='a']", div));
    await shouldHappen(() => querySingle("//div.ticl-tree-node-text[text()='b']", div));
  });
});
