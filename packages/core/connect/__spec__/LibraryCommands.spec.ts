import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Root, type Flow} from '../../block/Flow.ts';
import {MemoryFlowStorage} from '../../block/MemoryFlowStorage.ts';
import {makeLocalConnection} from '../LocalConnection.ts';

describe('Library commands', () => {
  let root: Root;
  let storage: MemoryFlowStorage;
  let server: ReturnType<typeof makeLocalConnection>[0];
  let client: ReturnType<typeof makeLocalConnection>[1];
  beforeEach(async () => {
    root = new Root();
    storage = new MemoryFlowStorage();
    await storage.saveLibraryMetadata('main', {dependencies: ['shared'], autoLoadFlows: ['entry']});
    await storage.saveLibraryMetadata('shared', {});
    await storage.saveLibraryMetadata('other', {});
    storage.saveFlow(null, {value: 1}, '+main.entry');
    await root.setStorage(storage);
    await root.start({main: {}});
    [server, client] = makeLocalConnection(root, false);
  });
  afterEach(async () => {
    client.destroy();
    await root.stop({discardChanges: true});
    root.destroy();
  });

  it('controls the connected runtime without a file API and preserves dirty libraries', async () => {
    expect(await client.getLibraryGraph()).toMatchObject({
      roots: ['main'],
      dependencies: {main: ['shared'], shared: []},
      canLoad: true,
    });
    await client.enableLibrary('other');
    const flow = root.queryValue('+main.entry') as Flow;
    flow.setValue('value', 2);
    flow.trackChange();
    await expect(client.retainLibraries(['other'])).rejects.toContain('unsaved changes');
    await expect(client.unloadLibrary('main')).rejects.toContain('unsaved changes');
    expect(root.queryValue('+main.entry')).toBe(flow);
    expect((await client.getLibraryGraph()).roots).toEqual(['main', 'other']);

    await client.setLibraryDependencies('other', ['shared']);
    expect((await client.getLibraryMetadata('other')).metadata).toEqual({dependencies: ['shared']});
    expect(await storage.getLibraryMetadata('other')).toEqual({dependencies: ['shared']});
    await flow.applyChange();
    await client.retainLibraries(['other']);
    expect(root.getLibraryGraph()).toEqual({roots: ['other'], dependencies: {other: ['shared'], shared: []}});
    await client.unloadLibrary('other');
    expect(root.getLibraryGraph().roots).toEqual([]);
  });

  it('filters readonly graphs and rejects runtime or metadata writes at the server', async () => {
    await root.enableLibrary('other');
    server.setEditPolicy({readonly: true, allowPaths: ['+main', '+main.**']});
    expect(await client.getLibraryGraph()).toMatchObject({
      roots: ['main'],
      dependencies: {main: []},
      canLoad: false,
      hasMetadata: true,
    });
    expect((await client.getLibraryMetadata('main')).canWrite).toBe(false);
    await expect(client.getLibraryMetadata('other')).rejects.toBe('restricted path');
    for (const cmd of ['enableLibrary', 'unloadLibrary', 'retainLibraries', 'setLibraryDependencies']) {
      expect(server.executeRequest({cmd, path: '+main'})).toBe('readonly');
    }
    expect(root.getLibraryGraph().roots).toEqual(['main', 'other']);
  });

  it('validates library targets and reports persistence capabilities', async () => {
    await expect(client.simpleRequest({cmd: 'unloadLibrary', path: '+main.entry'})).rejects.toContain(
      'Invalid library'
    );
    await expect(client.simpleRequest({cmd: 'enableLibrary', path: '+#root'})).rejects.toContain(
      'Invalid library path'
    );
    expect((await client.getLibraryGraph()).roots).toEqual(['main']);
    Object.assign(storage, {persistent: false});
    expect((await client.getLibraryMetadata('main')).canWrite).toBe(false);
    await expect(client.setLibraryDependencies('main', [])).rejects.toBe('Storage is read-only');
    expect((await storage.getLibraryMetadata('main')).dependencies).toEqual(['shared']);
    const empty = new Root();
    const [, connection] = makeLocalConnection(empty, false);
    try {
      expect(await connection.getLibraryGraph()).toMatchObject({
        roots: [],
        dependencies: {},
        canLoad: false,
        hasMetadata: false,
      });
      expect(await connection.getLibraryMetadata('#root')).toMatchObject({canWrite: false});
    } finally {
      connection.destroy();
      empty.destroy();
    }
  });
});
