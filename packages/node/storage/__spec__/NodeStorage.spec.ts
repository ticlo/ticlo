import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Root, FlowFolder} from '@ticlo/core';
import {NodeStorage} from '../NodeStorage.ts';
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
});
