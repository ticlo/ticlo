import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BaseFunction, Root, decode, encodeSorted, globalFunctions, setSecretCipher, type Block} from '@ticlo/core';
import {aessiv} from '@noble/ciphers/aes.js';
import {bytesToHex, hexToBytes} from '@noble/ciphers/utils.js';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {fileStorageContract} from '@ticlo/core/storage/__spec__/FileStorageContract.ts';
import {
  addSecretPassword,
  initBrowserSecretCipher,
  listSecretPasswords,
  missingPrimaryPassword,
  onBrowserSecretNotice,
  removeSecretPassword,
  setPrimarySecretPassword,
  StaticStorage,
  RemoteStorage,
} from '../index.ts';
import {LocalProjectFiles} from '../LocalProjectFiles.ts';

const base = 'https://static.example/files';
const browserKeyName = 'ticlo-browser-secret-passwords';
const encoder = new TextEncoder();

class BrowserSecretTest extends BaseFunction {
  #getSecret: () => string | undefined;

  initInputs(getSecret: () => string | undefined) {
    this.#getSecret = getSecret;
  }

  configChanged() {
    return true;
  }

  run() {
    this._data.output(this.#getSecret());
  }
}

globalFunctions.addFactory(BrowserSecretTest, {name: 'browser-secret-test'}, null);
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
  let originalKey: string | null;
  beforeEach(async () => {
    originalKey = localStorage.getItem(browserKeyName);
    localStorage.removeItem(browserKeyName);
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
    setSecretCipher(undefined);
    vi.unstubAllGlobals();
    if (originalKey === null) localStorage.removeItem(browserKeyName);
    else localStorage.setItem(browserKeyName, originalKey);
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
  it('loads the guest global and keeps static files read-only while BrowserLocal remains writable', async () => {
    await root.setStorage(storage);
    expect(root._globalRoot.getValue('^setting')).toBe('guest');
    await root.start({main: {flows: ['entry']}, BrowserLocal: {}});
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
  it('prompts only when saving a pending secret and preserves undo and redo', async () => {
    const notice = vi.fn();
    const unsubscribe = onBrowserSecretNotice(notice);
    try {
      await root.setStorage(storage);
      await root.start({BrowserLocal: {}});
      const flow = root.addFlow('+BrowserLocal.secrets');
      const block = flow.createBlock('credential');
      block.setValue('#is', 'browser-secret-test');
      await flow.applyChange();
      flow.startHistory();
      block.setValue('#secret', 'pending value');
      flow.trackChange();
      flow.undo();
      root.runAll();
      expect(block.getValue('#output')).toBeUndefined();
      flow.redo();
      root.runAll();
      expect(block.getValue('#output')).toBe('pending value');
      expect(notice).not.toHaveBeenCalled();
      expect(() => encodeSorted(flow.saveSnapshot())).toThrow('cannot be serialized');
      await expect(flow.applyChange()).rejects.toThrow(missingPrimaryPassword);
      expect(notice).toHaveBeenCalledExactlyOnceWith({type: 'primary'});
      expect((await storage.loadFlow('+BrowserLocal.secrets')).credential).not.toHaveProperty('#secret');
      expect(flow.getValue('@has-change')).toBe(true);
      await addSecretPassword(encoder.encode('first password'));
      await flow.applyChange();
      expect(flow.getValue('@has-change')).toBeUndefined();
      expect((await storage.loadFlow('+BrowserLocal.secrets')).credential).toHaveProperty('#secret');

      await storage.saveModule('+BrowserLocal', 'tools', {});
      const module = await root.loadFlow({library: 'BrowserLocal', kind: 'module', name: 'tools'});
      module.createBlock('credential').setValue('#secret', 'module value');
      await removeSecretPassword(listSecretPasswords().primary);
      await expect(module.applyChange()).rejects.toThrow(missingPrimaryPassword);
      expect(await storage.loadModule('+BrowserLocal', 'tools')).toEqual({});
      await addSecretPassword(encoder.encode('first password'));
      await module.applyChange();
      expect((await storage.loadModule('+BrowserLocal', 'tools')).credential).toHaveProperty('#secret');
    } finally {
      unsubscribe();
    }
  });
  it('wraps derived keys with ticlo and uses the primary password for new secrets', async () => {
    await root.setStorage(storage);
    const password = encoder.encode('first password');
    const first = await addSecretPassword(password);
    expect(password.every((byte) => byte === 0)).toBe(true);
    const second = await addSecretPassword(encoder.encode('second password'));
    expect(listSecretPasswords()).toEqual({ids: [first, second], primary: first});
    const saved = localStorage.getItem(browserKeyName);
    expect(saved).not.toContain('first password');
    const wrappingKey = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ticlo')));
    const key = aessiv(wrappingKey).decrypt(hexToBytes(JSON.parse(saved).keys[0][1]));
    expect(key).toHaveLength(32);
    expect(first).toBe(bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', key)).subarray(0, 8)));

    await root.start({BrowserLocal: {}});
    const flow = root.addFlow('+BrowserLocal.secrets');
    const block = flow.createBlock('credential');
    block.setValue('#secret', '浏览器密码');
    await flow.applyChange();
    expect(flow.getValue('@has-change')).toBeUndefined();

    const initial = (await storage.loadFlow('+BrowserLocal.secrets')).credential as {'#secret': Uint8Array};
    expect(bytesToHex(initial['#secret'].subarray(-8))).toBe(first);
    await setPrimarySecretPassword(second);
    const next = flow.createBlock('next');
    next.setValue('#secret', 'another secret');
    await flow.applyChange();
    const persisted = await storage.loadFlow('+BrowserLocal.secrets');
    expect(persisted.credential).toEqual(initial);
    expect(bytesToHex((persisted.next as {'#secret': Uint8Array})['#secret'].subarray(-8))).toBe(second);
    const {data} = await storage.getFile('BrowserLocal/secrets.ticlo');
    expect(new TextDecoder().decode(data)).not.toContain('浏览器密码');
    expect(new TextDecoder().decode(data)).toContain('͢Bin:');

    const reopened = new StaticStorage(base);
    try {
      root.destroy();
      root = new Root();
      await root.setStorage(reopened);
      await root.start({BrowserLocal: {flows: ['secrets']}});
      expect(listSecretPasswords().primary).toBe(second);
      expect(root._globalRoot.getValue('^setting')).toBe('guest');
      const restored = root.queryValue('+BrowserLocal.secrets.credential') as Block;
      expect(restored._save()).toEqual(initial);

      setSecretCipher(undefined);
      await initBrowserSecretCipher();
      const standalone = new Root();
      try {
        const flow = standalone.addFlow('dashboard', {credential: {...initial, '#is': 'browser-secret-test'}});
        standalone.runAll();
        expect(flow.queryValue('credential.#output')).toBe('浏览器密码');
        expect((flow.save().credential as Record<string, unknown>)['#secret']).toEqual(initial['#secret']);
        await removeSecretPassword(second);
        expect(listSecretPasswords()).toEqual({ids: [first], primary: first});
      } finally {
        standalone.destroy();
      }
    } finally {
      await reopened.close();
    }
  });
  it('reads and writes the server user global with only its Block secret encrypted', async () => {
    const baseURL = `https://${crypto.randomUUID()}.example/file`;
    let saved = '{"^setting":"server global"}';
    let revision = '"initial"';
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      const query = new URL(url).searchParams;
      const op = query.get('op');
      if (op === 'user') return Response.json({id: 'alice'});
      expect(query.get('path')).toBe('usr/alice/#global.ticlo');
      if (op === 'get') return new Response(saved, {headers: {ETag: revision}});
      expect(op).toBe('upload');
      expect(new Headers(init.headers).get('If-Match')).toBe(revision);
      saved = new TextDecoder().decode(init.body as ArrayBuffer);
      revision = '"saved"';
      return new Response('', {headers: {ETag: revision}});
    });
    const remote = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    const reopened = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    const other = new RemoteStorage({baseURL, fetch: fetch as typeof globalThis.fetch});
    const notice = vi.fn();
    const unsubscribe = onBrowserSecretNotice(notice);
    try {
      await root.setStorage(remote);
      const id = await addSecretPassword(encoder.encode('shared browser password'));
      expect(root._globalRoot.getValue('^setting')).toBe('server global');
      const block = root._globalRoot.createBlock('credential');
      block.setValue('#is', 'browser-secret-test');
      block.setValue('#secret', 'global password');
      await root._globalRoot.applyChange();
      const data = decode(saved);
      expect(data['^setting']).toBe('server global');
      expect(data.credential['#secret']).toBeInstanceOf(Uint8Array);
      expect(saved).not.toContain('global password');

      root.destroy();
      root = new Root();
      await root.setStorage(reopened);
      await root.start({BrowserLocal: {flows: []}});
      root.runAll();
      expect(root._globalRoot.save()).toEqual(data);
      expect(root.queryValue('#global.credential.#output')).toBe('global password');
      expect(fetch.mock.calls.filter(([url]) => new URL(url).searchParams.get('op') === 'get')).toHaveLength(2);

      localStorage.removeItem(browserKeyName);
      root.destroy();
      root = new Root();
      await root.setStorage(other);
      await root.start({BrowserLocal: {flows: []}});
      root.runAll();
      expect(root.queryValue('#global.credential.#output')).toBeUndefined();
      expect(notice).toHaveBeenCalledExactlyOnceWith({type: 'decrypt', ids: [id]});
      root._globalRoot.setValue('^setting', 'updated in another browser');
      await root._globalRoot.applyChange();
      expect(decode(saved)).toEqual({...data, '^setting': 'updated in another browser'});
      expect(await addSecretPassword(encoder.encode('shared browser password'))).toBe(id);
      root.destroy();
      root = new Root();
      await root.setStorage(other);
      await root.start({BrowserLocal: {flows: []}});
      root.runAll();
      expect(root.queryValue('#global.credential.#output')).toBe('global password');
    } finally {
      unsubscribe();
      await Promise.all([remote.close(), reopened.close(), other.close()]);
      localStorage.removeItem(`ticlo-file-user:${baseURL}`);
    }
  });
  it('opens old browser ciphertext with the original local key', async () => {
    const name = 'ticlo-browser-secret-key';
    const previous = localStorage.getItem(name);
    const wrappingKey = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode('ticlo')));
    const key = crypto.getRandomValues(new Uint8Array(32));
    const ciphertext = aessiv(key, encoder.encode('#secret')).encrypt(encoder.encode('old secret'));
    localStorage.setItem(name, bytesToHex(aessiv(wrappingKey).encrypt(key)));
    try {
      await initBrowserSecretCipher();
      const flow = root.addFlow('legacy', {credential: {'#is': 'browser-secret-test', '#secret': ciphertext}});
      root.runAll();
      expect(flow.queryValue('credential.#output')).toBe('old secret');
      expect(flow.save().credential).toEqual({'#is': 'browser-secret-test', '#secret': ciphertext});
      expect(listSecretPasswords()).toEqual({ids: [], primary: undefined});
    } finally {
      if (previous === null) localStorage.removeItem(name);
      else localStorage.setItem(name, previous);
    }
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
