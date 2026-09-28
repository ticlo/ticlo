import {beforeAll, expect, vi} from 'vitest';
import Fs from 'fs';
import type {Flow} from '@ticlo/core';
import {Root, decode, FlowFolder} from '@ticlo/core';
import {shouldHappen, shouldReject, waitTick} from '@ticlo/core/util/test-util.ts';
import {FileFlowStorage, FileStorage} from '../FileStorage.ts';

describe('FileStorage', function () {
  beforeAll(() => {
    Fs.mkdirSync('./temp', {recursive: true});
  });

  it('starts with an empty global flow without generating files in empty storage', async () => {
    const dir = Fs.mkdtempSync('./temp/empty-storage-');
    const root = new Root();
    try {
      await root.setStorage(new FileFlowStorage(dir));
      await root.start();
      expect(root._globalRoot.save()).toEqual({'#is': ''});
      expect(await root.listFlows('#root')).toEqual([]);
      expect(Fs.readdirSync(dir)).toEqual([]);
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
      Fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  it.each([undefined, {}])(
    'starts all root flows without starting other projects when no project is selected (%j)',
    async (options) => {
      const dir = Fs.mkdtempSync('./temp/default-projects-');
      const root = new Root();
      try {
        const storage = new FileFlowStorage(dir);
        await storage.saveFlow(null, {value: 1}, 'entry');
        await storage.saveFlow(null, {value: 2}, 'folder.nested');
        await storage.saveFlow(null, {value: 3}, '+main.jobs.daily');
        await storage.saveFlow(null, {'value': 4, '#disabled': true}, '+shared.entry');
        await storage.saveLib('+main', 'service', {value: 5});
        await storage.saveLib('+main', 'unused', {value: 6});
        await storage.saveNamespaceMetadata('main', {serviceLibraries: ['service']});
        await root.setStorage(storage);
        await root.start(options);
        expect(root.queryValue('entry.value')).toBe(1);
        expect(root.queryValue('folder.nested.value')).toBe(2);
        expect(root.queryValue('+main')).toBeUndefined();
        expect(root.queryValue('+shared')).toBeUndefined();
        expect(root.queryValue('+main.:unused')).toBeUndefined();
        await root.stop();
        // An explicit empty root selection loads no ordinary flows.
        await root.start({'#root': {}});
        expect(root.queryValue('entry')).toBeUndefined();
        expect(root.queryValue('folder.nested')).toBeUndefined();
        expect(root.queryValue('+main.jobs.daily')).toBeUndefined();
        expect(root.queryValue('+main.:service')).toBeUndefined();
      } finally {
        await root.stop({discardChanges: true});
        root.destroy();
        Fs.rmSync(dir, {recursive: true, force: true});
      }
    }
  );
  it('rejects persistent lifecycle toggles when a file write fails and allows retry', async () => {
    const storage = new FileFlowStorage('./temp/storageWriteFailure');
    await storage.saveFlow(null, {value: 1}, 'entry');
    const root = new Root();
    await root.setStorage(storage);
    await root.start({'#root': {flows: ['entry']}});
    const entry = {namespace: '#root', kind: 'flow', name: 'entry'} as const;
    const write = vi.spyOn(Fs, 'writeFile').mockImplementationOnce(((_path: string, _data: string, done: any) => {
      queueMicrotask(() => done(new Error('write failed')));
    }) as any);
    try {
      await expect(root.disableFlow(entry, {persist: true})).rejects.toThrow('write failed');
      expect(root.getFlowState(entry)).toBe('enabled');
      expect((await storage.loadFlow('entry'))['#disabled']).toBeUndefined();
      await root.disableFlow(entry, {persist: true});
      expect(root.getFlowState(entry)).toBe('disabled');
      expect(JSON.parse(Fs.readFileSync('./temp/storageWriteFailure/entry.ticlo', 'utf8'))['#disabled']).toBe(true);
    } finally {
      write.mockRestore();
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });
  it('listen to value', async function () {
    const storage = new FileStorage('./temp/storageTest');
    storage.save('key1', 'value1');
    expect(await storage.load('key1')).toBe('value1');
    expect(await storage.load('invalid key')).toBeUndefined();

    let result: string;
    const listener = (str: string) => (result = str);
    storage.listen('key2', listener);
    storage.save('key2', 'value2');
    expect(result).toBe('value2');

    storage.unlisten('key2', listener);
    storage.save('key2', 'new value');
    // should not change after unlisten
    expect(result).toBe('value2');

    storage.delete('key1');
    storage.delete('key2');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/key1') && !Fs.existsSync('./temp/storageTest/key2'));
  });
  it('caches completed I/O until the value is deleted', async function () {
    const storage = new FileStorage('./temp/storageTest');
    const readSpy = vi.spyOn(Fs, 'readFile');

    storage.save('cached-task', 'value');
    const task = storage.tasks['cached-task'];
    await shouldHappen(() => !task.current);
    expect(await storage.load('cached-task')).toBe('value');
    expect(await storage.load('cached-task')).toBe('value');
    expect(readSpy).not.toHaveBeenCalled();
    expect(storage.tasks['cached-task']).toBe(task);

    storage.delete('cached-task');
    await shouldHappen(() => storage.tasks['cached-task'] === undefined);
    expect(await storage.load('cached-task')).toBeUndefined();
    expect(readSpy).toHaveBeenCalledOnce();
    readSpy.mockRestore();
  });
  it('serializes reads behind queued file mutations', async function () {
    const storage = new FileStorage('./temp/storageTest');
    let unlinkDone: (err: NodeJS.ErrnoException | null) => void;
    let writeDone: (err: NodeJS.ErrnoException | null) => void;
    const unlinkSpy = vi.spyOn(Fs, 'unlink').mockImplementation(((_path: string, callback: any) => {
      unlinkDone = callback;
    }) as any);
    const writeSpy = vi.spyOn(Fs, 'writeFile').mockImplementation(((_path: string, _data: any, callback: any) => {
      writeDone = callback;
    }) as any);
    const readSpy = vi.spyOn(Fs, 'readFile').mockImplementation((() => {
      throw new Error('readFile must not run while a mutation is queued');
    }) as any);

    try {
      storage.delete('serialized-task');
      const task = storage.tasks['serialized-task'];
      storage.save('serialized-task', 'new value');

      expect(await storage.load('serialized-task')).toBe('new value');
      expect(readSpy).not.toHaveBeenCalled();

      unlinkDone(null);
      expect(task.current).toBe('write');
      expect(storage.tasks['serialized-task']).toBe(task);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(await storage.load('serialized-task')).toBe('new value');

      writeDone(null);
      expect(task.current).toBeNull();
      expect(storage.tasks['serialized-task']).toBe(task);
      expect(await storage.load('serialized-task')).toBe('new value');
    } finally {
      unlinkSpy.mockRestore();
      writeSpy.mockRestore();
      readSpy.mockRestore();
    }
  });
  it('save and delete flow', async function () {
    const path = './temp/storageTest/flow1.ticlo';
    const root = new Root();
    const storage = new FileFlowStorage('./temp/storageTest');
    await root.setStorage(storage);

    let flow = root.addFlow('flow1');
    flow.applyChange();
    let savedData: string;
    await shouldHappen(() => (savedData = Fs.existsSync(path) ? Fs.readFileSync(path, 'utf8') : null));
    expect(savedData).toBe('{\n"#is": ""\n}');

    root.deleteFlow('flow1');
    await shouldHappen(() => !Fs.existsSync(path), 500);

    // overwrite multiple times
    flow = root.addFlow('flow2');
    flow.applyChange();
    flow.setValue('value', 123);
    flow.applyChange();
    root.deleteFlow('flow2');
    flow = root.addFlow('flow2');
    flow.setValue('value', 456);
    flow.applyChange();
    await waitTick(20);
    const readResult = await storage.loadFlow('flow2');
    expect(readResult).toEqual({'#is': '', 'value': 456});

    // overwrite delete after write
    flow = root.addFlow('flow3');
    flow.applyChange();
    root.deleteFlow('flow3');
    root.addFlow('flow3');
    root.deleteFlow('flow3');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/flow3.ticlo'));

    // overwirte delete after delete
    root.addFlow('flow4');
    root.deleteFlow('flow4');
    root.addFlow('flow4');
    root.deleteFlow('flow4');
    await waitTick(40);
    expect(Fs.existsSync('./temp/storageTest/flow4.ticlo')).toBe(false);

    root.destroy();
  });
  it('init loader', async function () {
    const flowData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/folder5/subflow.ticlo';
    Fs.mkdirSync('./temp/storageTest/folder5', {recursive: true});
    Fs.writeFileSync(path1, JSON.stringify(flowData));

    const root = new Root();
    await root.setStorage(new FileFlowStorage('./temp/storageTest'));
    await root.start({'#root': {flows: ['**']}});

    expect(root.queryValue('folder5')).instanceof(FlowFolder);
    expect(root.queryValue('folder5.subflow.value')).toBe(321);
    expect((root.queryValue('folder5.subflow') as Flow).save()).toEqual(flowData);

    root.deleteFlow('folder5.subflow');
    root.destroy();
  });
  it('save and load libs', async function () {
    const storage = new FileFlowStorage('./temp/storageTest');
    const ns = '+testNs';
    const lib = 'testLib';
    const data = {worker: 'test'};

    storage.saveLib(ns, lib, data);
    await waitTick(50);

    const loaded = await storage.loadLib(ns, lib);
    expect(loaded).toEqual(data);

    const expectedPath = './temp/storageTest/+testNs/#libs/testLib.ticlo';
    expect(Fs.existsSync(expectedPath)).toBe(true);

    if (Fs.existsSync(expectedPath)) Fs.unlinkSync(expectedPath);
  });

  it('uses ticlo.json for dependency services and keeps unloading separate from file deletion', async () => {
    const dir = Fs.mkdtempSync('./temp/namespace-config-');
    const root = new Root();
    try {
      const storage = new FileFlowStorage(dir);
      Fs.mkdirSync(`${dir}/+main`);
      Fs.mkdirSync(`${dir}/+shared`);
      Fs.writeFileSync(`${dir}/+main/_proj.json`, '{"owner":"unchanged"}');
      await storage.saveNamespaceMetadata('main', {dependencies: ['shared']});
      await storage.saveNamespaceMetadata('shared', {serviceLibraries: ['service']});
      await storage.saveLib('+shared', 'service', {'#disabled': true});
      await storage.saveFlow(null, {value: 1}, '+main.entry');
      await root.setStorage(storage);
      await root.start({main: {}});
      expect(root.getFlowState({namespace: 'shared', kind: 'library', name: 'service'})).toBe('disabled');
      expect(root.queryValue('+main.entry')).toBeUndefined();
      const entry = {namespace: 'main', kind: 'flow', name: 'entry'} as const;
      await root.loadFlow(entry);
      await root.disableFlow(entry, {persist: true});
      await root.unloadFlow(entry);
      expect(Fs.existsSync(`${dir}/+main/entry.ticlo`)).toBe(true);
      await root.loadFlow(entry);
      expect(root.getFlowState(entry)).toBe('disabled');
      await root.stop();
      expect(JSON.parse(Fs.readFileSync(`${dir}/+main/ticlo.json`, 'utf8'))).toEqual({dependencies: ['shared']});
      expect(Fs.readFileSync(`${dir}/+main/_proj.json`, 'utf8')).toBe('{"owner":"unchanged"}');
    } finally {
      root.destroy();
      Fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  it('creates and reloads namespace directories, including empty folders', async () => {
    const dir = Fs.mkdtempSync('./temp/namespace-folders-');
    const root = new Root();
    const reloaded = new Root();
    try {
      const storage = new FileFlowStorage(dir);
      await root.setStorage(storage);
      root.addFlowFolder('+main');
      root.addFlowFolder('+main.empty');
      root.addFlowFolder('+main.libs.nested', null, true);
      const flow = root.addFlow('+main.libs.nested.flow', {value: 42});
      flow.applyChange();
      await storage.getTask('+main.libs.nested.flow').whenIdle();
      expect(JSON.parse(Fs.readFileSync(`${dir}/+main/libs/nested/flow.ticlo`, 'utf8')).value).toBe(42);
      storage.saveLib('+main', 'tools', {worker: 'library'});
      await storage.getTask('+main.:tools').whenIdle();
      await reloaded.setStorage(new FileFlowStorage(dir));
      await reloaded.start({main: {flows: ['**']}});
      expect(reloaded.queryValue('+main.libs.nested.flow.value')).toBe(42);
      expect(reloaded.queryValue('+main.empty')).toBeInstanceOf(FlowFolder);
      expect(reloaded.queryValue('+main.#libs')).toBeUndefined();
      expect(await reloaded._storage.loadLib('+main', 'tools')).toEqual({worker: 'library'});
      await reloaded.deleteFlow('+main.libs');
      expect(Fs.existsSync(`${dir}/+main/libs`)).toBe(false);
      expect(Fs.existsSync(`${dir}/+main/#libs/tools.ticlo`)).toBe(true);
    } finally {
      root.destroy();
      reloaded.destroy();
      await Promise.all(
        [root, reloaded].flatMap((item) =>
          Object.values((item._storage as FileFlowStorage)?.tasks ?? {}).map((task) => task.whenIdle())
        )
      );
      Fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});
