import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {routeFileStorage} from '@ticlo/file-server';
import {Root, encodeSorted} from '@ticlo/core';
import {FileServerFlowStorage, FileServerStorage, TicloFileClient} from '../index.ts';

describe('FileServerStorage integration', () => {
  let dir: string;
  let client: TicloFileClient;
  let close: () => Promise<void>;
  let root: Root;

  async function project(id: string, files: Record<string, unknown> = {}) {
    const path = join(dir, 'proj', id);
    await mkdir(path, {recursive: true});
    await writeFile(join(path, '_proj.json'), JSON.stringify({id, name: id}));
    for (const [file, data] of Object.entries(files)) {
      await mkdir(join(path, file, '..'), {recursive: true});
      await writeFile(join(path, file), encodeSorted(data));
    }
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ticlo-storage-'));
    await project('_root', {'#global.ticlo': {'#is': '', '^value': 42}});
    const app = new Hono();
    routeFileStorage(app, {rootDir: dir});
    await new Promise<void>((resolve) => {
      const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0}, (address) => {
        client = new TicloFileClient({baseURL: `http://127.0.0.1:${address.port}/file`});
        resolve();
      });
      close = () =>
        new Promise<void>((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
    });
    root = new Root();
  });

  afterEach(async () => {
    root?.destroy();
    await close?.();
    await rm(dir, {recursive: true, force: true});
  });

  it('loads recursive and circular deps once, skips invalid files, and always reads globals from _root', async () => {
    await project('_root', {'#global.ticlo': {'#is': '', '^value': 42}, 'unused.ticlo': {value: 9}});
    await project('main', {'run.ticlo': {value: 1}, 'bad:name.ticlo': {value: 99}, '#global.ticlo': {'^value': 99}});
    await project('shared', {'folder.flow.ticlo': {value: 2}});
    await project('common', {'run.ticlo': {value: 3}});
    await project('unrelated', {'run.ticlo': {value: 4}});
    for (const path of ['main/deps/shared', 'main/deps/common', 'shared/deps/common', 'common/deps/main']) {
      await mkdir(join(dir, 'proj', path), {recursive: true});
    }
    const storage = new FileServerFlowStorage(client, 'main');
    await root.setStorage(storage);
    expect([...storage.projects].sort()).toEqual(['common', 'main', 'shared']);
    expect(root.queryValue('+main.run.value')).toBe(1);
    expect(root.queryValue('+shared.folder.flow.value')).toBe(2);
    expect(root.queryValue('+common.run.value')).toBe(3);
    expect(root.queryValue('+main.bad:name')).toBeUndefined();
    expect(root.queryValue('+unrelated')).toBeUndefined();
    expect(root.queryValue('unused')).toBeUndefined();
    expect(root._globalRoot.getValue('^value')).toBe(42);
  });

  it('defaults to _root and persists flows and globals without deleting them on shutdown', async () => {
    const storage = new FileServerFlowStorage(client);
    await root.setStorage(storage);
    const flow = root.addFlow('newFlow', {value: 1});
    flow.setValue('value', 2);
    await flow.applyChange();
    expect(await storage.loadFlow('newFlow')).toEqual({'#is': '', 'value': 2});
    root._globalRoot.setValue('^value', 43);
    await root._globalRoot.applyChange();
    root.destroy();
    root = new Root();
    await root.setStorage(new FileServerFlowStorage(client));
    expect(root.queryValue('newFlow.value')).toBe(2);
    expect(root._globalRoot.getValue('^value')).toBe(43);
    await root.deleteFlow('newFlow');
    expect(await storage.loadFlow('newFlow')).toBeNull();
  });

  it('keeps libraries separate from ordinary flows and preserves filename escaping', async () => {
    await project('main', {'same.ticlo': {value: 'flow'}, 'libs/same.ticlo': {value: 'library'}});
    const storage = new FileServerFlowStorage(client, 'main');
    await root.setStorage(storage);
    expect(await storage.loadLib('+main', 'same')).toEqual({value: 'library'});
    await storage.saveLib('+main', 'same', {value: 'updated library'});
    expect((await storage.loadFlow('+main.same')).value).toBe('flow');
    expect(await storage.loadFlow('+main.:same')).toEqual({value: 'updated library'});
    const values = new FileServerStorage(client, 'proj/main/storage', '.str');
    await values.save('a/b?#%', 'value');
    expect(await values.load('a/b?#%')).toBe('value');
    expect(await readFile(join(dir, 'proj/main/storage/a%2fb%3f#%.str'), 'utf8')).toBe('value');
  });

  it('orders saves and deletes, notifies only after success, and detects another writer', async () => {
    const a = new FileServerStorage(client, 'proj/_root/storage', '.str');
    const b = new FileServerStorage(client, 'proj/_root/storage', '.str');
    const values: string[] = [];
    a.listen('key', (value) => values.push(value));
    await Promise.all([a.save('key', 'one'), a.save('key', 'two'), a.delete('key'), a.save('key', 'three')]);
    expect(values).toEqual(['one', 'two', null, 'three']);
    expect(await b.load('key')).toBe('three');
    await a.save('key', 'four');
    await expect(b.save('key', 'stale')).rejects.toMatchObject({response: {status: 412}});
    await expect(b.delete('key')).rejects.toMatchObject({response: {status: 412}});
    expect(await b.load('key')).toBe('four');
    await b.save('key', 'five');
    expect(await a.load('key')).toBe('five');
  });

  it('rejects missing dependency projects instead of silently running a partial graph', async () => {
    await mkdir(join(dir, 'proj/_root/deps/missing'), {recursive: true});
    const storage = new FileServerFlowStorage(client);
    await expect(root.setStorage(storage)).rejects.toMatchObject({response: {status: 404}});
    expect(storage.inited).toBe(false);
  });
});
