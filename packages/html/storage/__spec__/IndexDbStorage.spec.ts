import {expect} from 'vitest';
import type {IDBPDatabase} from 'idb';
import {deleteDB, openDB} from 'idb';
import type {Flow} from '@ticlo/core';
import {Root, decode, FlowFolder} from '@ticlo/core';
import {shouldHappen, shouldReject, waitTick} from '@ticlo/core/util/test-util.ts';
import {IndexDbFlowStorage, IndexDbStorage, FLOW_STORE_NAME} from '../IndexDbStorage.ts';

const testDbName = 'testIndexDb';

describe('IndexDbStorage', function () {
  let dbPromise: Promise<IDBPDatabase>;

  beforeAll(async () => {
    await deleteDB(testDbName);
    dbPromise = openDB(testDbName, undefined, {
      upgrade(db, oldVersion, newVersion, transaction) {
        db.createObjectStore('store');
        db.createObjectStore(FLOW_STORE_NAME);
        db.createObjectStore('namespaces');
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
    await root.start({'#root': {flows: ['**']}});

    const db = await storage.dbPromise;

    let flow = root.addFlow('flow1');
    flow.applyChange();
    await waitTick(20);
    const savedData: string = await db.get(FLOW_STORE_NAME, 'flow1');
    expect(savedData).toBe('{\n"#is": ""\n}');

    await root.deleteFlow('flow1');
    await waitTick(20);
    expect(await db.get(FLOW_STORE_NAME, 'flow1')).not.toBeDefined();

    // overwrite multiple times
    flow = root.addFlow('flow2');
    flow.applyChange();
    flow.setValue('value', 123);
    flow.applyChange();
    await root.deleteFlow('flow2');
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
    await root.start({'#root': {flows: ['**']}});

    expect(root.queryValue('folder5')).instanceof(FlowFolder);
    expect(root.queryValue('folder5.subflow.value')).toBe(321);
    expect((root.queryValue('folder5.subflow') as Flow).save()).toEqual(flowData);

    await root.deleteFlow('folder5.subflow');

    root.destroy();
  });
  it('save and load libs', async function () {
    const storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);
    const ns = 'testNs';
    const lib = 'testLib';
    const data = {worker: 'test'};

    await storage.saveLib(ns, lib, data);

    const loaded = await storage.loadLib(ns, lib);
    expect(loaded).toEqual(data);

    const db = await storage.dbPromise;
    const raw = await db.get(FLOW_STORE_NAME, `${ns}.#.${lib}`);
    expect(JSON.parse(raw)).toEqual(data);
  });

  it('persists namespace metadata and disabled state without persisting the loaded set', async () => {
    const storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);
    await storage.saveNamespaceMetadata('metaMain', {dependencies: ['metaShared']});
    await storage.saveNamespaceMetadata('metaShared', {serviceLibraries: ['service']});
    await storage.saveLib('+metaShared', 'service', {'#disabled': true});
    await storage.saveFlow(null, {value: 1}, '+metaMain.entry');
    const root = new Root();
    try {
      await root.setStorage(storage);
      await root.start({metaMain: {}});
      const entry = {namespace: 'metaMain', kind: 'flow', name: 'entry'} as const;
      const service = {namespace: 'metaShared', kind: 'library', name: 'service'} as const;
      expect(root.getFlowState(service)).toBe('disabled');
      expect(root.getFlowState(entry)).toBe('unloaded');
      await root.loadFlow(entry);
      await root.disableFlow(entry, {persist: true});
      await root.stop();
      expect(await storage.loadFlow('+metaMain.entry')).toMatchObject({'#disabled': true});
      await root.start({metaMain: {}});
      expect(root.getFlowState(entry)).toBe('unloaded');
      await root.loadFlow(entry);
      expect(root.getFlowState(entry)).toBe('disabled');
    } finally {
      await root.stop({discardChanges: true});
      root.destroy();
    }
  });

  it('keeps dotted keys and reloads deeply nested namespace folders', async () => {
    const storage = new IndexDbFlowStorage(FLOW_STORE_NAME, dbPromise);
    const key = '+folderNs.libs.deep.nested.flow';
    await storage.saveFlow(null, {value: 42}, key);
    const db = await dbPromise;
    expect(await db.get(FLOW_STORE_NAME, key)).toBeDefined();
    const root = new Root();
    await root.setStorage(storage);
    await root.start({folderNs: {flows: ['**']}});
    expect(root.queryValue(`${key}.value`)).toBe(42);
    expect(root.queryValue('+folderNs.libs.deep.nested')).toBeInstanceOf(FlowFolder);
    expect((root.queryValue(key) as Flow)._namespace).toBe('+folderNs');
    root.destroy();
  });
});
