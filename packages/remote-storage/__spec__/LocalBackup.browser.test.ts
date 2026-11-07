import {afterEach, describe, expect, it, vi} from 'vitest';
import {LocalFileBackups} from '../LocalFileBackups.ts';
import {LocalProjectFiles} from '../LocalProjectFiles.ts';
import {RemoteStorage} from '../RemoteStorage.ts';

describe('remote file backups', () => {
  const opened: RemoteStorage[] = [];
  afterEach(async () => {
    await Promise.all(opened.map((storage) => storage.close()));
    opened.length = 0;
  });

  it('keeps a failed flow save across reloads, reads it offline, and clears it only after a successful save', async () => {
    const baseURL = `https://backup-${crypto.randomUUID()}.example/file`;
    let online = true;
    let writable = false;
    let saved = '{"value":1}';
    let revision = '"first"';
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (!online) throw new Error('Network unavailable');
      const query = new URL(url).searchParams;
      switch (query.get('op')) {
        case 'user':
          return new Response(JSON.stringify({id: 'alice'}));
        case 'get':
          return new Response(saved, {headers: {ETag: revision}});
        case 'list':
          return new Response(
            JSON.stringify([{path: 'proj/main/entry.ticlo', name: 'entry.ticlo', type: 'file', gitStatus: 'deleted'}])
          );
        case 'info':
          return new Response(JSON.stringify({path: 'proj/main/entry.ticlo', name: 'entry.ticlo', type: 'file'}));
        case 'upload':
          if (!writable) return new Response('Permission denied', {status: 403});
          expect(new Headers(init.headers).get('If-Match')).toBe(revision);
          saved = new TextDecoder().decode(init.body as ArrayBuffer);
          revision = '"second"';
          return new Response('', {headers: {ETag: revision}});
        default:
          throw new Error(`Unexpected operation ${query.get('op')}`);
      }
    });
    const storage = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    opened.push(storage);
    expect(await storage.loadFlow('+main.entry')).toEqual({value: 1});
    await expect(storage.saveFlow(null, {value: 2}, '+main.entry')).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(await storage.loadFlow('+main.entry')).toEqual({value: 2});
    expect(await storage.getFileInfo('main/entry.ticlo')).toMatchObject({localBackup: true});
    expect(await storage.listFiles('main')).toMatchObject([{localBackup: true, gitStatus: undefined}]);

    const otherUser = new RemoteStorage({
      baseURL,
      fetch: (async (url: string, init: RequestInit) =>
        new URL(url).searchParams.get('op') === 'user'
          ? new Response(JSON.stringify({id: 'bob'}))
          : fetch(url, init)) as typeof globalThis.fetch,
    });
    opened.push(otherUser);
    expect(await otherUser.loadFlow('+main.entry')).toEqual({value: 1});
    localStorage.setItem(`ticlo-file-user:${baseURL}`, 'alice');

    online = false;
    const reopened = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    opened.push(reopened);
    expect(await reopened.loadFlow('+main.entry')).toEqual({value: 2});
    expect(await reopened.listFiles('main')).toMatchObject([{path: 'main/entry.ticlo', localBackup: true}]);

    online = true;
    writable = true;
    await reopened.saveFlow(null, {value: 3}, '+main.entry');
    expect(await reopened.loadFlow('+main.entry')).toEqual({value: 3});
    expect(await reopened.getFileInfo('main/entry.ticlo')).not.toHaveProperty('localBackup');
    expect(JSON.parse(saved)).toEqual({value: 3});
  });

  it('does not back up an ordinary file upload', async () => {
    const storage = new RemoteStorage({
      baseURL: `https://backup-${crypto.randomUUID()}.example/file`,
      fetch: vi.fn(async () => new Response('Permission denied', {status: 403})),
    });
    opened.push(storage);
    await expect(storage.uploadFile('main/photo.png', new Uint8Array([1, 2]))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(storage.getFileInfo('main/photo.png')).rejects.toMatchObject({code: 'permission-denied'});
  });

  it('discards this project’s local backups after a successful history reset', async () => {
    const baseURL = `https://backup-${crypto.randomUUID()}.example/file`;
    const fetch = vi.fn(async (url: string) => {
      switch (new URL(url).searchParams.get('op')) {
        case 'user':
          return Response.json({id: 'alice'});
        case 'get':
          return new Response('{"value":1}', {headers: {ETag: '"first"'}});
        case 'upload':
          return new Response('Permission denied', {status: 403});
        case 'gitReset':
          return Response.json({backupBranch: 'backup/2026-11-07-01-00'});
        case 'info':
          return Response.json({path: 'proj/main/entry.ticlo', name: 'entry.ticlo', type: 'file'});
        default:
          throw new Error('Unexpected file request');
      }
    });
    const storage = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    opened.push(storage);
    expect(await storage.loadFlow('+main.entry')).toEqual({value: 1});
    await expect(storage.saveFlow(null, {value: 2}, '+main.entry')).rejects.toMatchObject({code: 'permission-denied'});
    expect(await storage.getFileInfo('main/entry.ticlo')).toMatchObject({localBackup: true});

    await storage.resetGitToCommit('main', 'abc');
    expect(await storage.getFileInfo('main/entry.ticlo')).not.toHaveProperty('localBackup');
    expect(await storage.loadFlow('+main.entry')).toEqual({value: 1});
  });

  it('adds the backup store without losing files from the existing local project', async () => {
    const name = `ticlo-backup-upgrade-${crypto.randomUUID()}`;
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name, 1);
      open.onupgradeneeded = () => {
        const entries = open.result.createObjectStore('entries', {keyPath: 'path'});
        entries.createIndex('parent', 'parent');
        open.result.createObjectStore('contents');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = old.transaction(['entries', 'contents'], 'readwrite');
    tx.objectStore('entries').put({path: 'saved.txt', name: 'saved.txt', parent: '', type: 'file'});
    tx.objectStore('contents').put(new TextEncoder().encode('existing').buffer, 'saved.txt');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    old.close();

    const backups = new LocalFileBackups(name);
    const local = new LocalProjectFiles(name);
    try {
      await backups.put({scope: 'server', path: 'proj/main/entry.ticlo', data: new ArrayBuffer(0), modified: 1});
      expect(new TextDecoder().decode((await local.getFile('saved.txt')).data)).toBe('existing');
      expect(await backups.get('server', 'proj/main/entry.ticlo')).toMatchObject({modified: 1});
    } finally {
      await Promise.all([backups.close(), local.close()]);
      indexedDB.deleteDatabase(name);
    }
  });
});
