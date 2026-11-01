import React from 'react';
import {afterEach, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import type {ClientConnection} from '@ticlo/core/connect/ClientConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {NodeTree} from '../NodeTree.tsx';

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
