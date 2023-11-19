import expect from 'expect';
import Fs from 'fs';
import {Flow, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {IndexDbStorage, STORE_NAME} from '../IndexDbStorage';

const testDbName = 'ticloTestIndexDbStorage';
describe('IndexDbStorage', function () {
  it('save and delete', async function () {
    await IndexDbStorage.deleteDb(testDbName);

    let root = new Root();
    let storage = new IndexDbStorage(testDbName);
    await root.setStorage(storage);

    const db = await storage.dbPromise;

    let flow = root.addFlow('flow1');
    flow.applyChange();
    await waitTick(20);
    let savedData: string = await db.get(STORE_NAME, 'flow1');
    expect(savedData).toBe('{\n"#is": ""\n}');

    root.deleteFlow('flow1');
    await waitTick(20);
    expect(await db.get(STORE_NAME, 'flow1')).not.toBeDefined();

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

    root.destroy();
  });
  it('init loader', async function () {
    let flowData = {'#is': '', 'value': 321};
    let storage = new IndexDbStorage(testDbName);

    const db = await storage.dbPromise;
    db.put(STORE_NAME, JSON.stringify(flowData), 'flow5');
    await db.put(STORE_NAME, JSON.stringify(flowData), 'flow5.subflow');

    let root = new Root();
    await root.setStorage(storage);

    expect(root.queryValue('flow5.value')).toBe(321);
    expect(root.queryValue('flow5.subflow.value')).toBe(321);
    expect((root.getValue('flow5') as Flow).save()).toEqual(flowData);

    root.destroy();
  });
});
