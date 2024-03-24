import {expect} from 'vitest';
import {deleteDB, IDBPDatabase, openDB} from 'idb';
import {Flow, Root, decode} from '../../../core';
import {shouldHappen, shouldReject, waitTick} from '../../../core/util/test-util';
import {IndexDbFlowStorage, IndexDbStorage, FLOW_STORE_NAME} from '../IndexDbStorage';

const testDbName = 'testIndexDb';

describe('IndexDbStorage', function () {
  let dbPromise: Promise<IDBPDatabase>;

  beforeAll(async () => {
    await deleteDB(testDbName);
    dbPromise = openDB(testDbName, undefined, {
      upgrade(db, oldVersion, newVersion, transaction) {
        db.createObjectStore('store');
        db.createObjectStore(FLOW_STORE_NAME);
      },
      blocked() {},
      blocking() {},
      terminated() {},
    });
  });
  it('listen to value', async function () {
    const storage = new IndexDbStorage('store', dbPromise);
    const db = await storage.dbPromise;

    await storage.save('key1', 'value1');
    expect(await storage.load('key1')).toBe('value1');
    expect(await storage.load('invalid key')).toBeUndefined();

    let result: string;
    const listener = (str: string) => (result = str);
    storage.listen('key2', listener);
    await storage.save('key2', 'value2');
    expect(result).toBe('value2');

    storage.unlisten('key2', listener);
    await storage.save('key2', 'new value');
    // should not change after unlisten
    expect(result).toBe('value2');

    await storage.delete('key1');
    expect(await db.get('store', 'key1')).not.toBeDefined();
  });

  it('save and delete', async function () {
    const root = new Root();
    const storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);
    await root.setStorage(storage);

    const db = await storage.dbPromise;

    let flow = root.addFlow('flow1');
    flow.applyChange();
    await waitTick(20);
    let savedData: string = await db.get(FLOW_STORE_NAME, 'flow1');
    expect(savedData).toBe('{\n"#is": ""\n}');

    root.deleteFlow('flow1');
    await waitTick(20);
    expect(await db.get(FLOW_STORE_NAME, 'flow1')).not.toBeDefined();

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
    let storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);

    const db = await storage.dbPromise;
    db.put(FLOW_STORE_NAME, JSON.stringify(flowData), 'flow5');
    await db.put(FLOW_STORE_NAME, JSON.stringify(flowData), 'flow5.subflow');

    let root = new Root();
    await root.setStorage(storage);

    expect(root.queryValue('flow5.value')).toBe(321);
    expect(root.queryValue('flow5.subflow.value')).toBe(321);
    expect((root.getValue('flow5') as Flow).save()).toEqual(flowData);

    root.destroy();
  });
});
