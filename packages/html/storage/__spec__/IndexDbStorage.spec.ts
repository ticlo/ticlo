import {expect} from 'vitest';
import type {IDBPDatabase} from 'idb';
import {deleteDB, openDB} from 'idb';
import type {Flow} from '@ticlo/core';
import {Root, decode, FlowFolder} from '@ticlo/core';
import {shouldHappen, shouldReject, waitTick} from '@ticlo/core/util/test-util.js';
import {IndexDbFlowStorage, IndexDbStorage, FLOW_STORE_NAME} from '../IndexDbStorage.js';

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
    const savedData: string = await db.get(FLOW_STORE_NAME, 'flow1');
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
    const readResult = await storage.loadFlow('flow2');
    expect(readResult).toEqual({'#is': '', 'value': 456});

    root.destroy();
  });
  it('init loader', async function () {
    const flowData = {'#is': '', 'value': 321};
    const storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);

    const db = await storage.dbPromise;
    await db.put(FLOW_STORE_NAME, JSON.stringify(flowData), 'folder5.subflow');

    const root = new Root();
    await root.setStorage(storage);

    expect(root.queryValue('folder5')).instanceof(FlowFolder);
    expect(root.queryValue('folder5.subflow.value')).toBe(321);
    expect((root.queryValue('folder5.subflow') as Flow).save()).toEqual(flowData);

    root.deleteFlow('folder5.subflow');

    root.destroy();
  });
});
