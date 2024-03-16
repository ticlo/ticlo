import {openDB, deleteDB, wrap, unwrap, IDBPDatabase} from 'idb';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '../../../src/core';
import {WorkerFunction} from '../../../src/core/worker/WorkerFunction';
import {FlowLoader, FlowState} from '../../../src/core/block/Flow';

export const STORE_NAME = 'flows';

export class IndexDbStorage implements Storage {
  dbPromise: Promise<IDBPDatabase>;
  constructor(dbName: string) {
    this.dbPromise = openDB(dbName, undefined, {
      upgrade(db, oldVersion, newVersion, transaction) {
        db.createObjectStore(STORE_NAME);
      },
      blocked() {},
      blocking() {},
      terminated() {},
    });
  }

  async delete(key: string) {
    await (await this.dbPromise).delete(STORE_NAME, key);
  }

  async save(key: string, data: string) {
    await (await this.dbPromise).put(STORE_NAME, data, key);
  }

  async load(name: string) {
    try {
      return await (await this.dbPromise).get(STORE_NAME, name);
    } catch (e) {
      return null;
    }
  }
}

export class IndexDbFlowStorage extends IndexDbStorage implements FlowStorage {
  static deleteDb(dbName: string) {
    return deleteDB(dbName);
  }

  constructor(dbName: string = 'ticlo') {
    super(dbName);
  }

  getFlowLoader(key: string, prop: BlockProperty): FlowLoader {
    return {
      applyChange: (data: DataMap) => {
        this.saveFlow(null, data, key);
        return true;
      },
      onStateChange: (flow: Flow, state: FlowState) => this.flowStateChanged(flow, key, state),
    };
  }

  flowStateChanged(flow: Flow, key: string, state: FlowState) {
    switch (state) {
      case FlowState.destroyed:
        this.delete(key);
        break;
    }
  }

  async saveFlow(flow: Flow, data?: DataMap, overrideKey?: string) {
    if (!data) {
      data = flow.save();
    }
    let key = overrideKey ?? flow._storageKey;
    let str = encodeSorted(data);
    if (key) {
      await this.save(key, str);
    }
  }

  async loadFlow(name: string) {
    try {
      let str = await this.load(name);
      return decode(str); // decode(null) will return null
    } catch (e) {
      return null;
    }
  }

  inited = false;

  async init(root: Root) {
    let db = await this.dbPromise;
    let flowFiles: string[] = [];
    let functionFiles: string[] = [];
    let globalData = {'#is': ''};
    for (let storeKey of (await db.getAllKeys(STORE_NAME)) as string[]) {
      if (
        !storeKey.includes('.#') // Do not load subflow during initialization.
      ) {
        if (storeKey === '#global') {
          try {
            globalData = decode(await db.get(STORE_NAME, storeKey));
          } catch (err) {
            // TODO Logger
          }
        } else if (storeKey.startsWith('#.')) {
          functionFiles.push(storeKey.substring(2));
        } else {
          flowFiles.push(storeKey);
        }
      }
    }

    // load custom types
    for (let name of functionFiles.sort()) {
      try {
        let data = decode(await db.get(STORE_NAME, `#.${name}`));
        let desc = WorkerFunction.collectDesc(`:${name}`, data);
        WorkerFunction.registerType(data, desc, '');
      } catch (err) {
        // TODO Logger
      }
    }

    // load global block
    root._globalRoot.load(globalData, null, (saveData: DataMap) => {
      this.saveFlow(root._globalRoot, saveData);
      return true;
    });

    // load flow entries
    // sort the name to make sure parent Flow is loaded before children flows
    for (let name of flowFiles.sort()) {
      try {
        let data = decode(await (await this.dbPromise).get(STORE_NAME, name));
        root.addFlow(name, data);
      } catch (err) {
        // TODO Logger
      }
    }
    this.inited = true;
  }
}
