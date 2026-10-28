import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {fileStorageContract} from '@ticlo/core/storage/__spec__/FileStorageContract.ts';
import {StaticStorage, RemoteStorage} from '../index.ts';

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
    for (const entry of await storage.listFiles('local')) await storage.deleteFile(entry.path);
  });
  afterEach(async () => {
    root.destroy();
    await storage.close();
    vi.unstubAllGlobals();
  });
  fileStorageContract(() => storage, 'local');
  it('persists only the local project and never accesses the remote local project', async () => {
    await storage.saveFlow(null, {value: 7}, '+local.folder.entry');
    await storage.createDirectory('local/empty');
    const next = new RemoteStorage({baseURL: 'https://remote.example/file'});
    try {
      expect(await next.loadFlow('+local.folder.entry')).toEqual({value: 7});
      expect(await next.getFileInfo('local/empty')).toMatchObject({type: 'folder'});
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      await next.close();
    }
  });
  it('uses the guest global and denies static/user edits while local remains writable', async () => {
    await root.setStorage(storage);
    await root.start({main: {flows: ['entry']}, local: {}});
    expect(root._globalRoot.getValue('^setting')).toBe('guest');
    expect(root.queryValue('+main.entry.value')).toBe(1);
    await expect(storage.user.uploadFile('#global.ticlo', 'bad')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.createDirectory('main/new')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.deleteFile('main/entry.ticlo')).rejects.toMatchObject({code: 'readonly'});
    await expect(storage.moveFile('main/entry.ticlo', 'local/moved.ticlo')).rejects.toMatchObject({code: 'readonly'});
    await storage.copyFile('main/entry.ticlo', 'local/copied.ticlo');
    expect(await storage.loadFlow('+local.copied')).toEqual({value: 1});
    const local = root.addFlow('+local.editable', {value: 2});
    await local.applyChange();
    const [, conn] = makeLocalConnection(root);
    try {
      await expect(conn.setValue('+main.entry.value', 9, true)).rejects.toBe('Storage is read-only');
      await expect(conn.editWorker('#temp.#edit-static', undefined, '+main:worker', {})).rejects.toBe(
        'Storage is read-only'
      );
      await conn.setValue('+local.editable.value', 3, true);
      await conn.setValue('+local.editable.worker', {'#is': '', 'value': 4}, true);
      await conn.editWorker('+local.editable.#edit-worker', 'worker');
      await conn.setValue('+local.editable.#edit-worker.value', 5, true);
      await conn.applyFlowChange('+local.editable.#edit-worker');
      expect(local.getValue('worker')).toMatchObject({value: 5});
      await conn.applyFlowChange('+local.editable');
      expect(await storage.loadFlow('+local.editable')).toMatchObject({value: 3});
    } finally {
      conn.destroy();
    }
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
    expect(calls.every(([url]) => !String(url).includes('usr/admin'))).toBe(true);
  });
  it('keeps each flow revision separate from ordinary file-preview reads', async () => {
    await storage.saveFlow(null, {value: 1}, '+local.entry');
    const other = new RemoteStorage({baseURL: 'https://unused.example/file'});
    try {
      await other.loadFlow('+local.entry');
      await storage.saveFlow(null, {value: 2}, '+local.entry');
      await other.getFile('local/entry.ticlo');
      await expect(other.saveFlow(null, {value: 3}, '+local.entry')).rejects.toMatchObject({code: 'conflict'});
      expect(await storage.loadFlow('+local.entry')).toEqual({value: 2});
    } finally {
      await other.close();
    }
  });
});
