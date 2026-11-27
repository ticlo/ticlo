import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Root, FlowFolder, setSecretCipher} from '@ticlo/core';
import {randomBytes} from 'node:crypto';
import {NodeStorage} from '../NodeStorage.ts';
import {SecretCipher} from '../../secret/SecretCipher.ts';
import {fileStorageContract} from '@ticlo/core/storage/__spec__/FileStorageContract.ts';

describe('NodeStorage', () => {
  let dir: string;
  let storage: NodeStorage;
  let root: Root;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ticlo-node-storage-'));
    storage = new NodeStorage(dir);
    root = new Root();
  });
  afterEach(async () => {
    root.destroy();
    await rm(dir, {recursive: true, force: true});
  });
  fileStorageContract(() => storage, 'main');
  it('reuses saved ciphertext across saves and key changes until the secret is entered again', async () => {
    const first = new SecretCipher(randomBytes(32));
    const second = new SecretCipher(randomBytes(32));
    setSecretCipher(first);
    try {
      await root.setStorage(storage);
      await root.start();
      const flow = root.addFlow('entry');
      flow.startHistory();
      flow.setValue('#secret', 'test secret');
      flow.trackChange();
      await flow.applyChange();
      const initial = (await storage.loadFlow('entry'))['#secret'];
      expect(first.decode(initial)).toBe('test secret');
      expect(flow.getValue('@has-change')).toBeUndefined();

      setSecretCipher(second);
      flow.setValue('note', 'edited');
      await flow.applyChange();
      expect(await storage.loadFlow('entry')).toMatchObject({'#secret': initial, 'note': 'edited'});

      await root.unloadFlow({library: '#root', kind: 'flow', name: 'entry'});
      const reopened = await root.loadFlow({library: '#root', kind: 'flow', name: 'entry'});
      reopened.setValue('note', 'edited without the key');
      await reopened.applyChange();
      expect(await storage.loadFlow('entry')).toMatchObject({'#secret': initial, 'note': 'edited without the key'});

      reopened.setValue('#secret', 'test secret');
      await reopened.applyChange();
      const replaced = (await storage.loadFlow('entry'))['#secret'];
      expect(replaced).not.toEqual(initial);
      expect(second.decode(replaced)).toBe('test secret');
    } finally {
      setSecretCipher(undefined);
    }
  });
  it('uses #root for user globals and reads the file-server project layout directly', async () => {
    await storage.user.uploadFile('#global.ticlo', '{"^setting":42}');
    await storage.uploadFile('main/folder/flow.ticlo', '{"value":7}');
    await storage.uploadFile('main/#modules/tools.ticlo', '{"helper":true}');
    await storage.createDirectory('main/empty');
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(root._globalRoot.getValue('^setting')).toBe(42);
    expect(root.queryValue('+main.folder.flow.value')).toBe(7);
    expect(root.queryValue('+main.empty')).toBeInstanceOf(FlowFolder);
    expect(await storage.loadModule('+main', 'tools')).toEqual({helper: true});
    expect(await storage.listFlows('main')).toEqual(['folder.flow']);
    const flow = root.queryValue('+main.folder.flow') as import('@ticlo/core').Flow;
    flow.setValue('value', 8);
    await flow.applyChange();
    expect(JSON.parse(await readFile(join(dir, 'main/folder/flow.ticlo'), 'utf8')).value).toBe(8);
    expect(await readdir(dir)).toEqual(expect.arrayContaining(['#root', 'main']));
  });
  it('rejects symlinks that point outside the project root', async () => {
    await mkdir(join(dir, 'main'));
    await symlink(tmpdir(), join(dir, 'main/outside'));
    await expect(storage.uploadFile('main/outside/escape', 'bad')).rejects.toMatchObject({code: 'invalid-path'});
  });
  it('persists library metadata and context separately from project management metadata', async () => {
    await storage.createProject('main', {name: 'Main'});
    await storage.saveLibraryMetadata('main', {dependencies: ['shared']});
    await storage.createProject('shared');
    await storage.saveFlow(null, {'^setting': 10}, '+main.#context');
    expect(await storage.getLibraryMetadata('main')).toEqual({dependencies: ['shared']});
    expect(await storage.readProject('main')).toEqual({id: 'main', name: 'Main'});
    await root.setStorage(storage);
    await root.start({main: {}});
    expect(root.queryValue('+main.#context.^setting')).toBe(10);
  });
  it('migrates legacy project metadata when read', async () => {
    await mkdir(join(dir, 'main'));
    await writeFile(join(dir, 'main/_proj.json'), JSON.stringify({id: 'main', name: 'Legacy'}));
    expect(await storage.readProject('main')).toEqual({id: 'main', name: 'Legacy'});
    expect(await readdir(join(dir, 'main'))).toEqual(['.proj']);
  });
  it('uses direct file changes for Git status and commit without writing gitlog', async () => {
    await storage.createProject('main');
    await storage.uploadFile('main/entry.ticlo', '{"value":1}');
    expect(await storage.initGit('main')).toMatchObject({initialized: true, branch: 'main'});
    expect((await storage.getFileInfo('main/entry.ticlo')).gitStatus).toBe('added');
    const first = await storage.commitGit('main', 'Initial');
    expect(first.author).toBe('node');
    expect(await readFile(join(dir, 'main/.gitlog'), 'utf8')).toBe('');

    await storage.uploadFile('main/entry.ticlo', '{"value":2}');
    expect((await storage.listFiles('main')).find((entry) => entry.name === 'entry.ticlo')?.gitStatus).toBe('modified');
    await storage.restoreGitFile('main/entry.ticlo');
    expect(await readFile(join(dir, 'main/entry.ticlo'), 'utf8')).toBe('{"value":1}');
    expect(await readFile(join(dir, 'main/.gitlog'), 'utf8')).toBe('');

    await storage.deleteFile('main/entry.ticlo');
    expect((await storage.listFiles('main')).find((entry) => entry.name === 'entry.ticlo')?.gitStatus).toBe('deleted');
    await storage.restoreGitFile('main/entry.ticlo');
    expect(await readFile(join(dir, 'main/entry.ticlo'), 'utf8')).toBe('{"value":1}');

    await storage.uploadFile('main/entry.ticlo', '{"value":3}');
    await storage.commitGit('main', 'Later');
    expect(await storage.getGitHistory('main')).toHaveLength(2);
    expect(await storage.getGitBranches('main')).toEqual(['main']);
    await storage.createDirectory('main/empty');
    const snapshot = await storage.createProjectFromCommit('main', 'snapshot', first.hash);
    expect(snapshot.id).toBe('snapshot');
    expect((await storage.getGitInfo('snapshot')).initialized).toBe(false);
    expect(await readFile(join(dir, 'snapshot/entry.ticlo'), 'utf8')).toBe('{"value":1}');
    const {backupBranch} = await storage.resetGitToCommit('main', first.hash);
    expect(await readFile(join(dir, 'main/entry.ticlo'), 'utf8')).toBe('{"value":1}');
    expect(await storage.getGitBranches('main')).toContain(backupBranch);
    await storage.deleteGitBranch('main', backupBranch);
    expect(await storage.getGitBranches('main')).toEqual(['main']);
  });

  it('resolves project/external file paths and reads project, callback, and network files', async () => {
    await storage.uploadFile('main/local.txt', 'from-main');
    await storage.uploadFile('#root/root.txt', 'from-root');

    // Default storage forbids case 1) urls and case 2) external paths in resolveFilePath.
    expect(storage.resolveFilePath('http://example.com/a.txt', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('https://example.com/a.txt', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('//cdn.example.com/a.txt', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('/etc/passwd', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('./a.txt', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('../a.txt', '+main')).toBeUndefined();

    // Case 3) and 4) resolve to local full paths.
    expect(storage.resolveFilePath('+main/local.txt')).toBe(join(dir, 'main/local.txt'));
    expect(storage.resolveFilePath('+/local.txt', '+main')).toBe(join(dir, 'main/local.txt'));
    expect(storage.resolveFilePath('+/root.txt', '+#root')).toBe(join(dir, '#root/root.txt'));
    expect(storage.resolveFilePath('local.txt', '+main')).toBeUndefined();
    expect(storage.resolveFilePath('+main/../escape.txt')).toBeUndefined();

    await expect(storage.readFile('/etc/passwd')).rejects.toMatchObject({code: 'permission-denied'});
    await expect(storage.readFile('local.txt', '+main')).rejects.toMatchObject({code: 'invalid-path'});
    expect(new TextDecoder().decode((await storage.readFile('+/local.txt', '+main')).data)).toBe('from-main');
    expect(new TextDecoder().decode((await storage.readFile('+main/local.txt', '+other')).data)).toBe('from-main');

    // Custom callback enables case 2) resolution and reading.
    const externalFile = join(dir, 'external-asset.txt');
    await writeFile(externalFile, 'external-data');
    const customStorage = new NodeStorage(dir, (filePath, lib) =>
      filePath === './asset.txt' && lib === 'main' ? externalFile : undefined
    );
    expect(customStorage.resolveFilePath('//cdn.example.com/a.txt', '+main')).toBeUndefined();
    expect(customStorage.resolveFilePath('./asset.txt', '+main')).toBe(externalFile);
    expect(customStorage.resolveFilePath('./other.txt', '+main')).toBeUndefined();
    expect(new TextDecoder().decode((await customStorage.readFile('./asset.txt', '+main')).data)).toBe('external-data');
    await expect(customStorage.readFile('./other.txt', '+main')).rejects.toMatchObject({code: 'permission-denied'});

    // Case 1) reads from network via fetch (including // -> https://).
    const mockFetch = vi.fn(async (url: string) => new Response(`fetched:${url}`, {headers: {ETag: '"v1"'}}));
    vi.stubGlobal('fetch', mockFetch);
    try {
      const httpRes = await storage.readFile('https://example.com/data.txt');
      expect(new TextDecoder().decode(httpRes.data)).toBe('fetched:https://example.com/data.txt');
      expect(httpRes.revision).toBe('"v1"');

      const protoRelRes = await storage.readFile('//cdn.example.com/data.txt');
      expect(new TextDecoder().decode(protoRelRes.data)).toBe('fetched:https://cdn.example.com/data.txt');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('resolves function file-path inputs from Root storage and guards unresolved project/url paths', async () => {
    const {Flow, MemoryFlowStorage, Root} = await import('@ticlo/core');
    const {resolveFilePath} = await import('../../index.ts');

    const root = new Root();
    try {
      await root.setStorage(storage);
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);
      const block = flow.createBlock('reader');
      expect(resolveFilePath(block, '+/db.sqlite')).toBe(join(dir, 'proj1/db.sqlite'));
      expect(resolveFilePath(block, '+other/db.sqlite')).toBe(join(dir, 'other/db.sqlite'));
      expect(resolveFilePath(block, 'https://example.com/db.sqlite')).toBeUndefined();
      expect(resolveFilePath(block, './external.sqlite')).toBeUndefined();
      expect(resolveFilePath(block, '')).toBeUndefined();
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }

    const memRoot = new Root();
    try {
      await memRoot.setStorage(new MemoryFlowStorage());
      const flow = memRoot.addFlow('+proj1.main', undefined, undefined, true);
      const block = flow.createBlock('reader');
      expect(resolveFilePath(block, '+/db.sqlite')).toBeUndefined();
      expect(resolveFilePath(block, '+other/db.sqlite')).toBeUndefined();
      expect(resolveFilePath(block, 'https://example.com/db.sqlite')).toBeUndefined();
      expect(resolveFilePath(block, './local.sqlite')).toBe('./local.sqlite');
    } finally {
      memRoot.destroy();
    }

    const standalone = new Flow();
    const standaloneBlock = standalone.createBlock('node');
    expect(resolveFilePath(standaloneBlock, '/tmp/test.sqlite')).toBe('/tmp/test.sqlite');
    standalone.destroy();
  });

  it('resolves HTTP URLs via fileBaseUrl/fileUrlScope for NodeStorage and file:toUrl', async () => {
    const {Flow, Root} = await import('@ticlo/core');
    let dynamicBase: string | undefined = 'http://127.0.0.1:8010/file';
    const urlStorage = new NodeStorage(dir, {
      fileBaseUrl: () => dynamicBase,
      fileUrlScope: 'serv',
    });

    expect(urlStorage.resolveFileUrl('+/img/logo 1.png', '+proj1')).toBe(
      'http://127.0.0.1:8010/file/serv/proj1/img/logo%201.png'
    );
    expect(urlStorage.resolveFileUrl('+other/icon#1.svg', '+proj1')).toBe(
      'http://127.0.0.1:8010/file/serv/other/icon%231.svg'
    );
    expect(urlStorage.resolveFileUrl('https://cdn.example.com/a.png', '+proj1')).toBe('https://cdn.example.com/a.png');
    expect(urlStorage.resolveFileUrl('./local.png', '+proj1')).toBe('./local.png');
    expect(storage.resolveFileUrl('+/img/logo.png', '+proj1')).toBeUndefined();

    const urlRoot = new Root();
    try {
      await urlRoot.setStorage(urlStorage);
      await urlRoot.start();
      const flow = urlRoot.addFlow('+proj1.main', undefined, undefined, true);
      const block = flow.createBlock('toUrl');
      block.setValue('#is', 'file:toUrl');
      block.setValue('path', '+/bg.png');
      urlRoot._run();
      expect(block.getValue('#output')).toBe('http://127.0.0.1:8010/file/serv/proj1/bg.png');

      block.setValue('host', 'https://assets.example.com');
      block.setValue('css', true);
      urlRoot._run();
      expect(block.getValue('#output')).toBe("url('https://assets.example.com/file/serv/proj1/bg.png')");

      dynamicBase = undefined;
      urlStorage.setFileBaseUrl('http://127.0.0.1:9000/file');
      block.setValue('host', undefined);
      block.setValue('css', false);
      urlRoot._run();
      expect(block.getValue('#output')).toBe('http://127.0.0.1:9000/file/serv/proj1/bg.png');
    } finally {
      urlRoot.destroy();
    }
  });

  it('resolves and reads ++proj frontend paths when frontendDir is configured, and rejects them in backend-only mode', async () => {
    const {Flow, Root, StorageError} = await import('@ticlo/core');
    const backendDir = join(dir, 'serv');
    const frontendDir = join(dir, 'proj');
    await mkdir(join(frontendDir, 'ui'), {recursive: true});
    await writeFile(join(frontendDir, 'ui/logo.txt'), 'frontend-logo');

    const backendOnly = new NodeStorage(backendDir, {
      fileBaseUrl: 'http://127.0.0.1:8010/file',
      fileUrlScope: 'serv',
    });
    expect(backendOnly.resolveFilePath('++ui/logo.txt', '+proj1')).toBeUndefined();
    expect(backendOnly.resolveFileUrl('++ui/logo.txt', '+proj1')).toBeUndefined();
    await expect(backendOnly.readFile('++ui/logo.txt', '+proj1')).rejects.toThrowError(StorageError);

    const dualStorage = new NodeStorage(backendDir, {
      fileBaseUrl: 'http://127.0.0.1:8010/file',
      fileUrlScope: 'serv',
      frontendDir,
      frontendUrlScope: 'proj',
    });
    expect(dualStorage.resolveFilePath('++ui/logo.txt', '+proj1')).toBe(join(frontendDir, 'ui/logo.txt'));
    expect(dualStorage.resolveFileUrl('++ui/logo.txt', '+proj1')).toBe('http://127.0.0.1:8010/file/proj/ui/logo.txt');
    const read = await dualStorage.readFile('++ui/logo.txt', '+proj1');
    expect(new TextDecoder().decode(read.data)).toBe('frontend-logo');

    const dualRoot = new Root();
    try {
      await dualRoot.setStorage(dualStorage);
      await dualRoot.start();
      const flow = dualRoot.addFlow('+proj1.main', undefined, undefined, true);
      const block = flow.createBlock('toUrl');
      block.setValue('#is', 'file:toUrl');
      block.setValue('path', '++ui/logo.txt');
      dualRoot._run();
      expect(block.getValue('#output')).toBe('http://127.0.0.1:8010/file/proj/ui/logo.txt');
    } finally {
      await dualRoot.stop({discardChanges: true});
      dualRoot.destroy();
    }
  });
});
