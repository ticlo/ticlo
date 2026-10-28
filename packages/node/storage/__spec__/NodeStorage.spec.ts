import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {mkdtemp, mkdir, readFile, readdir, rm, symlink} from 'node:fs/promises';
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
    await storage.uploadFile('main/#libs/tools.ticlo', '{"helper":true}');
    await storage.createDirectory('main/empty');
    await root.setStorage(storage);
    await root.start({main: {flows: ['**']}});
    expect(root._globalRoot.getValue('^setting')).toBe(42);
    expect(root.queryValue('+main.folder.flow.value')).toBe(7);
    expect(root.queryValue('+main.empty')).toBeInstanceOf(FlowFolder);
    expect(await storage.loadLib('+main', 'tools')).toEqual({helper: true});
    expect(await storage.listFlows('main')).toEqual(['folder.flow']);
    const flow = root.queryValue('+main.folder.flow') as import('@ticlo/core').Flow;
    flow.setValue('value', 8);
    await flow.applyChange();
    expect(JSON.parse(await readFile(join(dir, 'main/folder/flow.ticlo'), 'utf8')).value).toBe(8);
    expect(await readdir(dir)).toEqual(expect.arrayContaining(['#root', 'main']));
  });
  it('starts empty without generating global files and retains failed saves as dirty', async () => {
    await root.setStorage(storage);
    await root.start();
    expect(await readdir(dir)).toEqual([]);
    await root.stop();
    await storage.createDirectory('main');
    await root.start({main: {}});
    const flow = root.addFlow('+main.new', {value: 1});
    await mkdir(join(dir, 'main/new.ticlo'));
    flow.setValue('value', 2);
    await expect(flow.applyChange()).rejects.toThrow();
    expect(flow.getValue('@has-change')).toBe(true);
    await rm(join(dir, 'main/new.ticlo'), {recursive: true});
    await flow.applyChange();
    expect(flow.getValue('@has-change')).toBeUndefined();
  });
  it('rejects symlinks that point outside the project root', async () => {
    await mkdir(join(dir, 'main'));
    await symlink(tmpdir(), join(dir, 'main/outside'));
    await expect(storage.uploadFile('main/outside/escape', 'bad')).rejects.toMatchObject({code: 'invalid-path'});
  });
  it('persists namespace metadata and context separately from project management metadata', async () => {
    await storage.createProject('main', {name: 'Main'});
    await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
    await storage.createProject('shared');
    await storage.saveFlow(null, {'^setting': 10}, '+main.#context');
    expect(await storage.getNamespaceMetadata('main')).toEqual({dependencies: ['shared']});
    expect(await storage.readProject('main')).toEqual({id: 'main', name: 'Main'});
    await root.setStorage(storage);
    await root.start({main: {}});
    expect(root.queryValue('+main.#context.^setting')).toBe(10);
  });
});
