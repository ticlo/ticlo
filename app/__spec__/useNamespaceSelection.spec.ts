import {expect, it} from 'vitest';
import {Flow, Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {loadNamespaceSelection} from '../useNamespaceSelection.ts';

it('keeps the default root unless the selected namespace becomes the default', async () => {
  const root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
  await storage.saveNamespaceMetadata('shared', {});
  await storage.saveNamespaceMetadata('other', {});
  await storage.saveNamespaceMetadata('extra', {});
  await root.setStorage(storage);
  await root.start({main: {}});
  await root.enableNamespace('extra');

  await loadNamespaceSelection(root, 'main', 'other', {setDefault: false, unloadOthers: true});
  expect(root.getNamespaceGraph().roots).toEqual(['main', 'other']);
  expect(root.getNamespaceGraph().dependencies).toEqual({main: ['shared'], shared: [], other: []});

  await loadNamespaceSelection(root, 'main', 'extra', {setDefault: true, unloadOthers: true});
  expect(root.getNamespaceGraph()).toEqual({roots: ['extra'], dependencies: {extra: []}});
  await root.stop();
  root.destroy();
});

it('reverts a newly loaded root when unloading others is rejected', async () => {
  const root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveNamespaceMetadata('main', {});
  await storage.saveNamespaceMetadata('other', {});
  await storage.saveFlow(null, {value: 1}, '+main.entry');
  await root.setStorage(storage);
  await root.start({main: {flows: ['entry']}});
  const flow = root.queryValue('+main.entry') as Flow;
  flow.setValue('value', 2);
  flow.trackChange();

  await expect(loadNamespaceSelection(root, 'main', 'other', {setDefault: true, unloadOthers: true})).rejects.toThrow(
    'unsaved changes'
  );
  expect(root.getNamespaceGraph().roots).toEqual(['main']);
  expect(root.getNamespaceGraph().dependencies).toEqual({main: []});
  await root.stop({discardChanges: true});
  root.destroy();
});
