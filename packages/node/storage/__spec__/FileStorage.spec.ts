import {expect, vi} from 'vitest';
import Fs from 'fs';
import type {Flow} from '@ticlo/core';
import {Root, decode, FlowFolder} from '@ticlo/core';
import {shouldHappen, shouldReject, waitTick} from '@ticlo/core/util/test-util.js';
import {FileFlowStorage, FileStorage} from '../FileStorage.js';

const beforeAll = globalThis.beforeAll ?? (globalThis as any).before;

describe('FileStorage', function () {
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
    flow = root.addFlow('flow3');
    root.deleteFlow('flow3');
    await waitTick(20);
    await shouldHappen(() => !Fs.existsSync('./temp/storageTest/flow3.ticlo'));

    // overwirte delete after delete
    flow = root.addFlow('flow4');
    root.deleteFlow('flow4');
    flow = root.addFlow('flow4');
    root.deleteFlow('flow4');
    await waitTick(40);
    expect(Fs.existsSync('./temp/storageTest/flow4.ticlo')).toBe(false);

    root.destroy();
  });
  it('init loader', async function () {
    const flowData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/folder5.subflow.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(flowData));

    const root = new Root();
    await root.setStorage(new FileFlowStorage('./temp/storageTest'));

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

    const expectedPath = './temp/storageTest/+testNs/testLib.ticlo';
    expect(Fs.existsSync(expectedPath)).toBe(true);

    if (Fs.existsSync(expectedPath)) Fs.unlinkSync(expectedPath);
  });
});
