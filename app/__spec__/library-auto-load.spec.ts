import {describe, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {createLibraryAutoLoad} from '../library-auto-load.ts';

describe('navigation library auto-load', () => {
  it('uses the library path to update its own namespace metadata', async () => {
    const root = new Root();
    const storage = new MemoryFlowStorage();
    await storage.saveNamespaceMetadata('main', {});
    await storage.saveNamespaceMetadata('shared', {});
    await root.setStorage(storage);
    const autoLoad = createLibraryAutoLoad(root);

    await autoLoad.set('+shared.:tools', true);
    expect(await autoLoad.get('+shared.:tools')).toBe(true);
    expect(await autoLoad.get('+main.:tools')).toBe(false);
    expect((await storage.getNamespaceMetadata('shared')).autoLoadLibraries).toEqual(['tools']);
    expect(await storage.getNamespaceMetadata('main')).toEqual({});

    await autoLoad.set(':rootTools', true);
    expect((await storage.getNamespaceMetadata('#root')).autoLoadLibraries).toEqual(['rootTools']);
    root.destroy();
  });
});
