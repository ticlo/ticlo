import {expect} from 'vitest';
import shelljs from 'shelljs';
import Fs from 'fs';
import {Flow, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {FileFlowStorage} from '../FileStorage';

const beforeAll = globalThis.beforeAll ?? globalThis.before;

describe('FileStorage', function () {
  beforeAll(function () {
    shelljs.mkdir('-p', './temp/storageTest');
  });
  it('save and delete', async function () {
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
    const path1 = './temp/storageTest/flow5.subflow.ticlo';
    Fs.writeFileSync(path1, JSON.stringify(flowData));

    const path2 = './temp/storageTest/flow5.ticlo';
    Fs.writeFileSync(path2, JSON.stringify(flowData));

    let root = new Root();
    await root.setStorage(new FileFlowStorage('./temp/storageTest'));

    expect(root.queryValue('flow5.value')).toBe(321);
    expect(root.queryValue('flow5.subflow.value')).toBe(321);
    expect((root.getValue('flow5') as Flow).save()).toEqual(flowData);

    Fs.unlinkSync(path2);
    root.destroy();
  });
});
