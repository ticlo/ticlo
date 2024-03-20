import {openDB, deleteDB, wrap, unwrap, IDBPDatabase} from 'idb';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '../../../src/core';
import {WorkerFunction} from '../../../src/core/worker/WorkerFunction';
import {FlowLoader, FlowState} from '../../../src/core/block/Flow';
import {StreamDispatcher} from '../../core/block/Dispatcher';

export const STORE_NAME = 'flows';
export const DB_NAME = 'ticlo';
export class IndexDbStorage implements Storage {
  readonly dbPromise: Promise<IDBPDatabase>;
  readonly streams: Map<string, StreamDispatcher<string>> = new Map();

  constructor(dbName: string, public readonly storeName: string) {
    this.dbPromise = openDB(dbName, undefined, {
      upgrade(db, oldVersion, newVersion, transaction) {
        db.createObjectStore(storeName);
      },
      blocked() {},
      blocking() {},
      terminated() {},
    });
  }

  async delete(key: string) {
    await (await this.dbPromise).delete(this.storeName, key);
  }

  async save(key: string, data: string) {
    await (await this.dbPromise).put(this.storeName, data, key);
    this.streams.get(key)?.dispatch(data);
  }

  async load(name: string) {
    try {
      return await (await this.dbPromise).get(this.storeName, name);
    } catch (e) {
      return null;
    }
  }

  listen(key: string, listener: (val: string) => void) {
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new StreamDispatcher<string>();
      this.streams.set(key, stream);
    }
    stream.listen(listener);
  }

  unlisten(key: string, listener: (val: string) => void) {
    let stream = this.streams.get(key);
    if (stream) {
      stream.unlisten(listener);
      if (stream.isEmpty()) {
        this.streams.delete(key);
      }
    }
  }
}

export class IndexDbFlowStorage extends IndexDbStorage implements FlowStorage {
  static deleteDb(dbName: string) {
    return deleteDB(dbName);
  }

  constructor(dbName: string = DB_NAME) {
    super(dbName, STORE_NAME);
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
    for (let storeKey of (await db.getAllKeys(this.storeName)) as string[]) {
      if (
        !storeKey.includes('.#') // Do not load subflow during initialization.
      ) {
        if (storeKey === '#global') {
          try {
            globalData = decode(await db.get(this.storeName, storeKey));
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
        let data = decode(await db.get(this.storeName, `#.${name}`));
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
        let data = decode(await (await this.dbPromise).get(this.storeName, name));
        root.addFlow(name, data);
      } catch (err) {
        // TODO Logger
      }
    }
    this.inited = true;
  }
}
