import React from 'react';
import {simulate} from 'simulate-event';
import {afterEach, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import type {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {NodeTree} from '../NodeTree.tsx';
import {NodeTreeItem} from '../NodeRenderer.tsx';

let root: Root;
let client: ClientConnection;
afterEach(async () => {
  removeLastTemplate();
  client?.destroy();
  await root?.stop({discardChanges: true});
  root?.destroy();
});

it('hides unloaded namespaces while retaining shared dependencies', async () => {
  root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
  await storage.saveNamespaceMetadata('other', {dependencies: ['shared']});
  await storage.saveNamespaceMetadata('shared', {});
  await root.setStorage(storage);
  await root.start({main: {}});
  await root.enableNamespace('other');
  [, client] = makeLocalConnection(root);
  const [, element] = loadTemplate(
    <NodeTree conn={client} basePaths={['']} hideRoot style={{width: 500, height: 500}} />,
    'editor'
  );
  await shouldHappen(() => element.textContent.includes('+main') && element.textContent.includes('+other'));

  await root.retainNamespaces(['other']);
  client.childrenChangeStream().dispatch({path: ''});
  await shouldHappen(() => !element.textContent.includes('+main') && element.textContent.includes('+shared'));
  expect(element.textContent).toContain('+other');
});

it('shows stored flows in a main namespace without loading them', async () => {
  root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveNamespaceMetadata('main', {autoLoadFlows: []});
  storage.saveFlow(null, {value: 1}, '+main.entry');
  await root.setStorage(storage);
  await root.start({main: {}});
  [, client] = makeLocalConnection(root);
  let tree: NodeTree;
  const [, element] = loadTemplate(
    <NodeTree
      ref={(value) => {
        tree = value;
      }}
      conn={client}
      basePaths={['']}
      hideRoot
      showStoredFlows
      style={{width: 500, height: 500}}
    />,
    'editor'
  );

  const namespace = await shouldHappen(() => tree?.rootList[0]?.children?.find((item) => item.key === '+main'));
  namespace.open();
  const stored = await shouldHappen(() => tree.rows.find((item) => item.key === '+main.entry'));
  await shouldHappen(() => element.textContent.includes('entry'));
  expect(stored).not.toBeInstanceOf(NodeTreeItem);
  expect(root.getFlowState({namespace: 'main', kind: 'flow', name: 'entry'})).toBe('unloaded');
  await tree.onStoredOpen(stored);
  await shouldHappen(() => root.getFlowState({namespace: 'main', kind: 'flow', name: 'entry'}) === 'enabled');
  await shouldHappen(() => tree.rows.find((item) => item.key === '+main.entry') instanceof NodeTreeItem);
  expect(tree.rows.filter((item) => item.key === '+main.entry')).toHaveLength(1);
});

it('offers Auto Load on a loaded normal flow without the stored-flow catalog', async () => {
  root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveNamespaceMetadata('main', {autoLoadFlows: []});
  storage.saveFlow(null, {value: 1}, '+main.entry');
  await root.setStorage(storage);
  await root.start({main: {flows: ['entry']}});
  [, client] = makeLocalConnection(root);
  let tree: NodeTree;
  const [, element] = loadTemplate(
    <NodeTree
      ref={(value) => {
        tree = value;
      }}
      conn={client}
      basePaths={['']}
      hideRoot
      style={{width: 500, height: 500}}
    />,
    'editor'
  );
  const namespace = await shouldHappen(() => tree?.rootList[0]?.children?.find((item) => item.key === '+main'));
  namespace.open();
  await shouldHappen(() =>
    tree.rows.some(
      (item) => item instanceof NodeTreeItem && item.key === '+main.entry' && item.functionId === 'flow:main'
    )
  );
  expect(await client.getAutoLoadFlow('+main.entry')).toMatchObject({autoLoad: false, canAutoLoad: true});
  const flow = await shouldHappen(() =>
    [...element.querySelectorAll<HTMLElement>('.ticl-e-tree-node-content')].find((node) =>
      node.textContent.includes('entry')
    )
  );
  simulate(flow, 'contextmenu', {button: 2, clientX: 50, clientY: 15});
  const menu = (await shouldHappen(() =>
    document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')
  )) as HTMLElement;
  const autoLoad = await shouldHappen(() =>
    menu.querySelector<HTMLElement>('.anticon-check')?.closest('.ticl-e-dropdown-menu-item')
  );
  simulate(autoLoad, 'click');
  await shouldHappen(() => storage.namespaces.get('main')?.autoLoadFlows?.includes('entry'));
});
