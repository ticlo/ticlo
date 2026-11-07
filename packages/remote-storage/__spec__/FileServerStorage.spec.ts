import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {routeFileStorage} from '@ticlo/web-server/file-storage.ts';
import {Root, Flow, FlowFolder, encodeSorted} from '@ticlo/core';
import {RemoteStorage, TicloFileClient} from '../index.ts';

describe('FileServerStorage integration', () => {
  let dir: string;
  let client: RemoteStorage;
  let baseURL: string;
  let close: () => Promise<void>;
  let root: Root;

  async function project(id: string, files: Record<string, unknown> = {}) {
    const path = join(dir, 'proj', id);
    await mkdir(path, {recursive: true});
    await writeFile(join(path, '.proj'), JSON.stringify({id, name: id}));
    for (const [file, data] of Object.entries(files)) {
      await mkdir(join(path, file, '..'), {recursive: true});
      await writeFile(join(path, file), encodeSorted(data));
    }
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ticlo-storage-'));
    await project('#root', {'#global.ticlo': {'#is': '', '^value': -1}});
    const app = new Hono();
    await mkdir(join(dir, 'usr/alice'), {recursive: true});
    await writeFile(join(dir, 'usr/alice/#global.ticlo'), encodeSorted({'#is': '', '^value': 42}));
    routeFileStorage(app, {
      rootDir: dir,
      authProvider: () => ({getUserId: () => 'alice', canRead: () => true, canWrite: () => true}),
    });
    await new Promise<void>((resolve) => {
      const server = serve({fetch: app.fetch, hostname: '127.0.0.1', port: 0}, (address) => {
        baseURL = `http://127.0.0.1:${address.port}/file`;
        client = new RemoteStorage({baseURL});
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

  it('uses the embedded file client for project and conditional file APIs', async () => {
    const api = new TicloFileClient({baseURL});
    expect(await api.getCurrentUser()).toEqual({id: 'alice'});
    const created = await api.createProject('client');
    expect(created.id).toBe('client');
    expect((await api.updateProject('client', {description: 'test'})).description).toBe('test');

    const path = 'proj/client/new.txt';
    const first = await api.uploadFileResponse(path, 'first', {}, {headers: {'If-None-Match': '*'}});
    await expect(api.uploadFile(path, 'stale', {}, {headers: {'If-Match': '"stale"'}})).rejects.toMatchObject({
      response: {status: 412},
    });
    expect((await api.getFile(path)).headers.etag).toBe(first.headers.etag);
    await api.initGit('client');
    await api.commitGit('client', 'Initial');
    const [{hash}] = await api.getGitHistory('client');
    expect((await api.createProjectFromCommit('snapshot', 'client', hash)).id).toBe('snapshot');
    await api.uploadFile(path, 'changed');
    await api.restoreGitFile(path);
    expect(new TextDecoder().decode((await api.getFile(path)).data)).toBe('first');
    await api.uploadFile(path, 'changed again');
    expect((await api.resetGitToCommit('client', hash)).backupBranch).toMatch(/^backup\//);
    expect(new TextDecoder().decode((await api.getFile(path)).data)).toBe('first');
    await api.deleteProject('snapshot');
    await api.deleteProject('client');
  });

  it('creates and deletes projects through the project API', async () => {
    const api = new TicloFileClient({baseURL});
    const created = await client.createProject('created', {description: 'New project'});
    expect(created).toMatchObject({id: 'created', name: 'created', owner: 'alice', description: 'New project'});
    expect(await client.readProject('created')).toEqual(created);
    expect(await api.listProjects()).toContainEqual(created);
    await expect(client.createProject('created')).rejects.toMatchObject({code: 'conflict'});
    await client.deleteProject('created');
    await expect(client.readProject('created')).rejects.toMatchObject({code: 'not-found'});
    expect(await api.listProjects()).not.toContainEqual(created);
  });

  it('updates protected project metadata through the project API and preserves other fields', async () => {
    await project('main');
    await project('other');
    const changes: string[] = [];
    client.subscribeFileChanges((path) => changes.push(path));

    await expect(client.uploadFile('main/.proj', '{}')).rejects.toMatchObject({code: 'permission-denied'});
    const updated = await client.updateProject('main', {description: 'Updated', id: 'other'});
    expect(updated).toEqual({id: 'main', name: 'main', description: 'Updated'});
    expect(await client.readProject('main')).toEqual(updated);
    expect(await client.readProject('other')).toEqual({id: 'other', name: 'other'});
    expect(changes).toEqual(['main/.proj']);

    await expect(client.updateProject('missing', {description: 'Missing'})).rejects.toMatchObject({code: 'not-found'});
    expect(changes).toEqual(['main/.proj']);
  });

  it('loads recursive and circular deps once, skips invalid files, and reads globals from the authenticated user', async () => {
    await project('#root', {'#global.ticlo': {'#is': '', '^value': -1}, 'unused.ticlo': {value: 9}});
    await project('main', {'run.ticlo': {value: 1}, 'bad:name.ticlo': {value: 99}, '#global.ticlo': {'^value': 99}});
    await project('shared', {'folder/flow.ticlo': {value: 2}});
    await project('common', {'run.ticlo': {value: 3}});
    await project('unrelated', {'run.ticlo': {value: 4}});
    for (const [name, dependencies] of Object.entries({
      main: ['shared', 'common'],
      shared: ['common'],
      common: ['main'],
    })) {
      await writeFile(join(dir, 'proj', name, 'ticlo.json'), JSON.stringify({dependencies}));
    }
    const storage = client;
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect([...storage.projects].sort()).toEqual(['common', 'main', 'shared']);
    expect(root.queryValue('+main.run.value')).toBe(1);
    expect(root.queryValue('+shared.folder.flow.value')).toBeUndefined();
    expect(root.queryValue('+common.run.value')).toBeUndefined();
    expect(root.queryValue('+main.bad:name')).toBeUndefined();
    expect(root.queryValue('+unrelated')).toBeUndefined();
    expect(root.queryValue('unused')).toBeUndefined();
    expect(root._globalRoot.getValue('^value')).toBe(42);
  });

  it.each([undefined, {}])('loads all root flows by default (%j)', async (options) => {
    await project('#root', {'entry.ticlo': {value: 1}, 'folder/nested.ticlo': {value: 2}});
    await project('main', {'entry.ticlo': {value: 3}});
    const storage = client;
    await root.setStorage(storage);
    await root.start(options);
    expect((await client.readProject('#root')).id).toBe('#root');
    expect([...storage.projects]).toEqual(['#root']);
    expect(root.queryValue('entry.value')).toBe(1);
    expect(root.queryValue('folder.nested.value')).toBe(2);
    expect(root.queryValue('+main')).toBeUndefined();
    const flow = root.addFlow('newFlow', {value: 1});
    flow.setValue('value', 2);
    await flow.applyChange();
    expect(await storage.loadFlow('newFlow')).toEqual({'#is': '', 'value': 2});
    root._globalRoot.setValue('^value', 43);
    await root._globalRoot.applyChange();
    root.destroy();
    root = new Root();
    await root.setStorage(client);
    await root.start({'#root': {flows: ['**']}});
    expect(root.queryValue('newFlow.value')).toBe(2);
    expect(root._globalRoot.getValue('^value')).toBe(43);
    await root.deleteFlow('newFlow');
    expect(await storage.loadFlow('newFlow')).toBeNull();
  });

  it('loads #root as a dependency without creating a namespace for it', async () => {
    await project('#root', {'plain.ticlo': {value: 7}});
    await project('main');
    await writeFile(join(dir, 'proj/main/ticlo.json'), JSON.stringify({dependencies: ['#root']}));
    const storage = client;
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(root.queryValue('plain.value')).toBeUndefined();
    expect(root.queryValue('+#root')).toBeUndefined();
    expect(storage.projects.has('#root')).toBe(true);
  });

  it('keeps libraries separate from ordinary flows and preserves filename escaping', async () => {
    await project('main', {'same.ticlo': {value: 'flow'}, '#libs/same.ticlo': {value: 'library'}});
    const storage = client;
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(await storage.loadLib('+main', 'same')).toEqual({value: 'library'});
    await storage.saveLib('+main', 'same', {value: 'updated library'});
    expect((await storage.loadFlow('+main.same')).value).toBe('flow');
    expect(await storage.loadFlow('+main.:same')).toEqual({value: 'updated library'});
    const values = client.getValueStorage('main');
    await values.save('a/b?#%', 'value');
    expect(await values.load('a/b?#%')).toBe('value');
    expect(await readFile(join(dir, 'proj/main/#storage/a%2Fb%3F%23%25.str'), 'utf8')).toBe('value');
  });

  it('orders saves and deletes, notifies only after success, and detects another writer', async () => {
    const a = client.getValueStorage('#root');
    const b = new RemoteStorage({baseURL}).getValueStorage('#root');
    const values: string[] = [];
    a.listen('key', (value) => values.push(value));
    await Promise.all([a.save('key', 'one'), a.save('key', 'two'), a.delete('key'), a.save('key', 'three')]);
    expect(values).toEqual(['one', 'two', null, 'three']);
    expect(await b.load('key')).toBe('three');
    await a.save('key', 'four');
    await expect(b.save('key', 'stale')).rejects.toMatchObject({code: 'conflict'});
    await expect(b.delete('key')).rejects.toMatchObject({code: 'conflict'});
    expect(await b.load('key')).toBe('four');
    await b.save('key', 'five');
    expect(await a.load('key')).toBe('five');
  });

  it('persists real namespace folders, empty folders and ordinary libs/deps/storage folders', async () => {
    await project('main');
    const storage = client;
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    for (const name of ['libs', 'deps', 'storage', '_libs', '_deps', '_storage']) {
      await root.addFlowFolder(`+main.${name}`).pendingCreate;
      await root.addFlowFolder(`+main.${name}.nested`).pendingCreate;
      const flow = root.addFlow(`+main.${name}.nested.flow`, {value: name});
      await flow.applyChange();
      expect(JSON.parse(await readFile(join(dir, `proj/main/${name}/nested/flow.ticlo`), 'utf8')).value).toBe(name);
    }
    await root.addFlowFolder('+main.empty').pendingCreate;
    await storage.saveLib('+main', 'tools', {worker: 'library'});
    root.destroy();
    root = new Root();
    const reloaded = client;
    await root.setStorage(reloaded);
    await root.start({main: {flows: ['**']}});
    expect(root.queryValue('+main.empty')).toBeInstanceOf(FlowFolder);
    expect(root.queryValue('+main.libs.nested.flow.value')).toBe('libs');
    expect(await reloaded.loadLib('+main', 'tools')).toEqual({worker: 'library'});
    expect(root.queryValue('+main.#libs')).toBeUndefined();
    for (const name of ['#libs', '#deps', '#storage']) {
      expect(() => root.addFlowFolder(`+main.${name}`)).toThrow('Reserved folder');
    }
    await root.deleteFlow('+main.libs');
    expect(root.queryValue('+main.libs')).toBeUndefined();
    expect(await client.listFiles('main/libs')).toEqual([]);
    expect(await reloaded.loadFlow('+main.libs.nested.flow')).toBeNull();
    expect(await reloaded.loadLib('+main', 'tools')).toEqual({worker: 'library'});
    await root.deleteFlow('+main.empty');
    expect((await client.listFiles('main')).some((entry) => entry.name === 'empty')).toBe(false);
  });

  it('loads and saves namespace context as a reserved flow file', async () => {
    await project('main', {
      '#context.ticlo': {'^value': 7},
      'entry.ticlo': {'~value': '^value'},
    });
    const storage = client;
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(root.queryValue('+main.entry.value')).toBe(7);
    expect(root._globalRoot.getValue('^value')).toBe(42);
    expect(await storage.listFlows('main')).toEqual(['entry']);
    const context = root.queryValue('+main.#context') as Flow;
    context.setValue('^value', 8);
    await context.applyChange();
    expect(JSON.parse(await readFile(join(dir, 'proj/main/#context.ticlo'), 'utf8'))['^value']).toBe(8);
    await root.stop();
    await root.start({main: {flows: ['entry']}});
    expect(root.queryValue('+main.entry.value')).toBe(8);
  });

  it('reads and writes ticlo.json without fetching or changing project management metadata', async () => {
    await project('main', {'#libs/service.ticlo': {'#disabled': true}, 'unused.ticlo': {value: 9}});
    const projectPath = join(dir, 'proj/main/.proj');
    const original = await readFile(projectPath, 'utf8');
    const get = vi.spyOn(client, 'getFile');
    const readProject = vi.spyOn(client, 'readProject');
    const storage = client;
    expect(await storage.getNamespaceMetadata('main')).toEqual({});
    await storage.saveNamespaceMetadata('main', {autoLoadLibraries: ['service']});
    expect(JSON.parse(await readFile(join(dir, 'proj/main/ticlo.json'), 'utf8'))).toEqual({
      autoLoadLibraries: ['service'],
    });
    await root.setStorage(storage);
    await root.start({main: {}});
    const service = {namespace: 'main', kind: 'library', name: 'service'} as const;
    expect(root.getFlowState(service)).toBe('disabled');
    expect(root.queryValue('+main.unused')).toBeUndefined();
    await root.setAutoLoadLibrary('main', 'service', false);
    expect(await storage.getNamespaceMetadata('main')).toEqual({autoLoadLibraries: []});
    expect(await readFile(projectPath, 'utf8')).toBe(original);
    expect(readProject).not.toHaveBeenCalled();
    expect(get.mock.calls.every(([path]) => !path.endsWith('.proj') && !path.endsWith('#proj.json'))).toBe(true);
    await root.stop();
    expect(await storage.loadLib('+main', 'service')).toEqual({'#disabled': true});
  });

  it('reads legacy serviceLibraries and saves only autoLoadLibraries', async () => {
    await project('main', {});
    const path = join(dir, 'proj/main/ticlo.json');
    await writeFile(path, JSON.stringify({serviceLibraries: ['tools']}));
    const metadata = await client.getNamespaceMetadata('main');
    expect(metadata).toEqual({autoLoadLibraries: ['tools']});
    await client.saveNamespaceMetadata('main', metadata);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({autoLoadLibraries: ['tools']});
  });

  it('rejects missing dependency projects instead of silently running a partial graph', async () => {
    await writeFile(join(dir, 'proj/#root/ticlo.json'), JSON.stringify({dependencies: ['missing']}));
    const storage = client;
    await root.setStorage(storage);
    await expect(root.start()).rejects.toMatchObject({code: 'not-found'});
    expect(root._lifecycle.started).toBe(false);
  });
});
