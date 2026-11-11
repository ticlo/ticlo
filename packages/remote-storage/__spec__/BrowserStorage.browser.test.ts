import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {fileStorageContract} from '@ticlo/core/storage/__spec__/FileStorageContract.ts';
import {StaticStorage, RemoteStorage} from '../index.ts';
import {LocalProjectFiles} from '../LocalProjectFiles.ts';

const base = 'https://static.example/files';
const files: Record<string, string> = {
  '/files/usr/guest/#global.ticlo': '{"^setting":"guest"}',
  '/files/proj/.list.json': '["main/"]',
  '/files/proj/main/.list.json': '["entry.ticlo","#context.ticlo"]',
  '/files/proj/main/entry.ticlo': '{"value":1}',
  '/files/proj/main/#context.ticlo': '{"^setting":"project"}',
};
describe('mixed browser storage', () => {
  let storage: StaticStorage;
  let root: Root;
  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = decodeURIComponent(new URL(url).pathname);
        return path in files ? new Response(files[path]) : new Response('Not found', {status: 404});
      })
    );
    storage = new StaticStorage(base);
    root = new Root();
    for (const entry of await storage.listFiles('BrowserLocal')) await storage.deleteFile(entry.path);
  });
  afterEach(async () => {
    root.destroy();
    await storage.close();
    vi.unstubAllGlobals();
  });
  fileStorageContract(() => storage, 'BrowserLocal');
  it('reports successful file writes through the storage instance', async () => {
    const changed: string[] = [];
    const unsubscribe = storage.subscribeFileChanges((path) => changed.push(path));
    await storage.uploadFile('BrowserLocal/a.txt', 'one');
    await storage.createDirectory('BrowserLocal/folder');
    await storage.moveFile('BrowserLocal/a.txt', 'BrowserLocal/folder/a.txt');
    await storage.deleteFile('BrowserLocal/folder/a.txt');
    expect(changed).toEqual([
      'BrowserLocal/a.txt',
      'BrowserLocal/folder',
      'BrowserLocal/folder/a.txt',
      'BrowserLocal/a.txt',
      'BrowserLocal/folder/a.txt',
    ]);
    unsubscribe();
    await storage.uploadFile('BrowserLocal/after.txt', 'two');
    expect(changed).toHaveLength(5);
  });
  it('opens existing IndexedDB files under BrowserLocal in both adapters', async () => {
    const existingFiles = new LocalProjectFiles('ticlo-local-files');
    try {
      await existingFiles.uploadFile('folder/entry.ticlo', '{"value":7}');
      await existingFiles.uploadFile('.proj', '{"id":"local","name":"My local project"}');
    } finally {
      await existingFiles.close();
    }
    expect(await storage.loadFlow('+BrowserLocal.folder.entry')).toEqual({value: 7});
    await storage.createDirectory('BrowserLocal/empty');
    const next = new RemoteStorage({baseURL: 'https://remote.example/file'});
    try {
      expect(await next.loadFlow('+BrowserLocal.folder.entry')).toEqual({value: 7});
      expect(await next.getFileInfo('BrowserLocal/empty')).toMatchObject({type: 'folder'});
      expect(await next.readProject('BrowserLocal')).toEqual({id: 'BrowserLocal', name: 'My local project'});
      const updated = await next.updateProject('BrowserLocal', {name: 'My browser project'});
      expect(updated).toEqual({id: 'BrowserLocal', name: 'My browser project'});
      expect(await storage.readProject('BrowserLocal')).toEqual(updated);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await next.close();
    }
  });
  it('uses the guest global and denies static/user edits while BrowserLocal remains writable', async () => {
    await root.setStorage(storage);
    await root.start({main: {flows: ['entry']}, BrowserLocal: {}});
    expect(root._globalRoot.getValue('^setting')).toBe('guest');
    expect(root.queryValue('+main.entry.value')).toBe(1);
    await expect(storage.user.uploadFile('#global.ticlo', 'bad')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.createDirectory('main/new')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.deleteFile('main/entry.ticlo')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.moveFile('main/entry.ticlo', 'BrowserLocal/moved.ticlo')).rejects.toMatchObject({
      code: 'readonly',
    });
    await storage.copyFile('main/entry.ticlo', 'BrowserLocal/copied.ticlo');
    expect(await storage.loadFlow('+BrowserLocal.copied')).toEqual({value: 1});
    const local = root.addFlow('+BrowserLocal.editable', {value: 2});
    await local.applyChange();
    const [, conn] = makeLocalConnection(root);
    try {
      await expect(conn.setValue('+main.entry.value', 9, true)).rejects.toBe('Storage is read-only');
      await expect(conn.editWorker('#temp.#edit-static', undefined, '+main:worker', {})).rejects.toBe(
        'Storage is read-only'
      );
      await conn.setValue('+BrowserLocal.editable.value', 3, true);
      await conn.setValue('+BrowserLocal.editable.worker', {'#is': '', 'value': 4}, true);
      await conn.editWorker('+BrowserLocal.editable.#edit-worker', 'worker');
      await conn.setValue('+BrowserLocal.editable.#edit-worker.value', 5, true);
      await conn.applyFlowChange('+BrowserLocal.editable.#edit-worker');
      expect(local.getValue('worker')).toMatchObject({value: 5});
      await conn.applyFlowChange('+BrowserLocal.editable');
      expect(await storage.loadFlow('+BrowserLocal.editable')).toMatchObject({value: 3});
    } finally {
      conn.destroy();
    }
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
    expect(calls.every(([url]) => !String(url).includes('usr/admin'))).toBe(true);
  });
  it('keeps each flow revision separate from ordinary file-preview reads', async () => {
    await storage.saveFlow(null, {value: 1}, '+BrowserLocal.entry');
    const other = new RemoteStorage({baseURL: 'https://unused.example/file'});
    try {
      await other.loadFlow('+BrowserLocal.entry');
      await storage.saveFlow(null, {value: 2}, '+BrowserLocal.entry');
      await other.getFile('BrowserLocal/entry.ticlo');
      await expect(other.saveFlow(null, {value: 3}, '+BrowserLocal.entry')).rejects.toMatchObject({code: 'conflict'});
      expect(await storage.loadFlow('+BrowserLocal.entry')).toEqual({value: 2});
    } finally {
      await other.close();
    }
  });
});
