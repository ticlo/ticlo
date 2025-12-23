import {expect} from 'vitest';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Flow, Root, decode, FlowFolder} from '@ticlo/core';
import {shouldHappen, shouldReject, waitTick} from '@ticlo/core/util/test-util.js';
import {FileFlowStorage, FileStorage} from '../FileStorage.js';

const beforeAll = globalThis.beforeAll ?? (globalThis as any).before;

describe('FileStorage', function () {
  it('listen to value', async function () {
    let storage = new FileStorage('./temp/storageTest');
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
  it('save and delete flow', async function () {
    const path = './temp/storageTest/flow1.ticlo';
    let root = new Root();
    let storage = new FileFlowStorage('./temp/storageTest');
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
    let readResult = await storage.loadFlow('flow2');
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
    let flowData = {'#is': '', 'value': 321};
    const path1 = './temp/storageTest/folder5.subflow.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(flowData));

    let root = new Root();
    await root.setStorage(new FileFlowStorage('./temp/storageTest'));

    expect(root.queryValue('folder5')).instanceof(FlowFolder);
    expect(root.queryValue('folder5.subflow.value')).toBe(321);
    expect((root.queryValue('folder5.subflow') as Flow).save()).toEqual(flowData);

    root.deleteFlow('folder5.subflow');
    root.destroy();
  });
});
