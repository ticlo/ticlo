import {expect, it} from 'vitest';
import {Flow, Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {loadLibrarySelection} from '../useLibrarySelection.ts';

it('keeps the default root unless the selected library becomes the default', async () => {
  const root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
  await storage.saveLibraryMetadata('shared', {});
  await storage.saveLibraryMetadata('other', {});
  await storage.saveLibraryMetadata('extra', {});
  await root.setStorage(storage);
  await root.start({main: {}});
  await root.enableLibrary('extra');

  await loadLibrarySelection(root, 'main', 'other', {setDefault: false, unloadOthers: true});
  expect(root.getLibraryGraph().roots).toEqual(['main', 'other']);
  expect(root.getLibraryGraph().dependencies).toEqual({main: ['shared'], shared: [], other: []});

  await loadLibrarySelection(root, 'main', 'extra', {setDefault: true, unloadOthers: true});
  expect(root.getLibraryGraph()).toEqual({roots: ['extra'], dependencies: {extra: []}});
  await root.stop();
  root.destroy();
});

it('reverts a newly loaded root when unloading others is rejected', async () => {
  const root = new Root();
  const storage = new MemoryFlowStorage();
  await storage.saveLibraryMetadata('main', {});
  await storage.saveLibraryMetadata('other', {});
  await storage.saveFlow(null, {value: 1}, '+main.entry');
  await root.setStorage(storage);
  await root.start({main: {flows: ['entry']}});
  const flow = root.queryValue('+main.entry') as Flow;
  flow.setValue('value', 2);
  flow.trackChange();

  await expect(loadLibrarySelection(root, 'main', 'other', {setDefault: true, unloadOthers: true})).rejects.toThrow(
    'unsaved changes'
  );
  expect(root.getLibraryGraph().roots).toEqual(['main']);
  expect(root.getLibraryGraph().dependencies).toEqual({main: []});
  await root.stop({discardChanges: true});
  root.destroy();
});
