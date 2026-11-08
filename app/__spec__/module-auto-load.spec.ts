import {describe, expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {MemoryFlowStorage} from '@ticlo/core/block/MemoryFlowStorage.ts';
import {createModuleAutoLoad} from '../module-auto-load.ts';

describe('navigation module auto-load', () => {
  it('uses the module path to update its own library metadata', async () => {
    const root = new Root();
    const storage = new MemoryFlowStorage();
    await storage.saveLibraryMetadata('main', {});
    await storage.saveLibraryMetadata('shared', {});
    await root.setStorage(storage);
    const autoLoad = createModuleAutoLoad(root);

    await autoLoad.set('+shared.:tools', true);
    expect(await autoLoad.get('+shared.:tools')).toBe(true);
    expect(await autoLoad.get('+main.:tools')).toBe(false);
    expect((await storage.getLibraryMetadata('shared')).autoLoadModules).toEqual(['tools']);
    expect(await storage.getLibraryMetadata('main')).toEqual({});

    await autoLoad.set(':rootTools', true);
    expect((await storage.getLibraryMetadata('#root')).autoLoadModules).toEqual(['rootTools']);
    root.destroy();
  });
});
