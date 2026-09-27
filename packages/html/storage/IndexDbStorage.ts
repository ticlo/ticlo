import {openDB, IDBPDatabase} from 'idb';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '@ticlo/core';
import {NamespaceMetadata} from '@ticlo/core/block/Storage.ts';
import {readNamespaceMetadata, validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {splitFlowStorageKey, validFlowEntry} from '@ticlo/core/util/FlowStoragePath.ts';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';

export const DB_NAME = 'ticlo';

export const FLOW_STORE_NAME = 'flows';
export const FUNCTION_STORE_NAME = 'storageFunction';
export const NAMESPACE_STORE_NAME = 'namespaces';
const DEFAULT_STORES = [FLOW_STORE_NAME, FUNCTION_STORE_NAME, NAMESPACE_STORE_NAME];
export class IndexDbStorage implements Storage {
  readonly dbPromise: Promise<IDBPDatabase>;
  readonly streams: Map<string, StreamDispatcher<string>> = new Map();
  db: IDBPDatabase;

  constructor(
    public readonly storeName: string,
    dbPromise?: Promise<IDBPDatabase>
  ) {
    if (dbPromise) {
      this.dbPromise = dbPromise;
    } else {
      if (DEFAULT_STORES.includes(storeName)) {
        // use the default ticlo database
        this.dbPromise = openDB(DB_NAME, 2, {
          upgrade(db, oldVersion, newVersion, transaction) {
            for (const defaultStoreName of DEFAULT_STORES) {
              if (!db.objectStoreNames.contains(defaultStoreName)) db.createObjectStore(defaultStoreName);
            }
          },
          blocked() {},
          blocking: () => {
            void this.dbPromise.then((db) => db.close());
          },
          terminated() {},
        });
      } else {
        // create a new database that contains single object store
        this.dbPromise = openDB(storeName, 2, {
          upgrade(db, oldVersion, newVersion, transaction) {
            if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
            if (!db.objectStoreNames.contains(NAMESPACE_STORE_NAME)) db.createObjectStore(NAMESPACE_STORE_NAME);
          },
          blocked() {},
          blocking: () => {
            void this.dbPromise.then((db) => db.close());
          },
          terminated() {},
        });
      }
      this.dbPromise.then((db) => {
        this.db = db;
      });
    }
  }

  async delete(key: string) {
    await (this.db ?? (await this.dbPromise)).delete(this.storeName, key);
    this.streams.get(key)?.dispatch(null);
  }

  async save(key: string, data: string) {
    await (this.db ?? (await this.dbPromise)).put(this.storeName, data, key);
    this.streams.get(key)?.dispatch(data);
  }

  async load(name: string) {
    try {
      return await (this.db ?? (await this.dbPromise)).get(this.storeName, name);
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
    const stream = this.streams.get(key);
    if (stream) {
      stream.unlisten(listener);
      if (stream.isEmpty()) {
        this.streams.delete(key);
      }
    }
  }
}

export class IndexDbFlowStorage extends IndexDbStorage implements FlowStorage {
  constructor(storeName: string = FLOW_STORE_NAME, dbPromise?: Promise<IDBPDatabase>) {
    super(storeName, dbPromise);
  }

  getFlowLoader(key: string, prop: BlockProperty): FlowLoader {
    return {
      applyChange: (flow: Flow) => {
        const data = flow.save();
        return this.saveFlow(null, data, key).then(() => data);
      },
    };
  }

  async saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    if (!data) {
      data = flow?.save();
    }
    const str = encodeSorted(data);
    if (key) {
      await this.save(key, str);
    }
  }

  async loadFlow(name: string) {
    try {
      const str = await this.load(name);
      return decode(str); // decode(null) will return null
    } catch (e) {
      return null;
    }
  }

  saveLib(ns: string, lib: string, data: DataMap) {
    return this.save(`${ns}.#.${lib}`, encodeSorted(data));
  }
  async loadLib(ns: string, lib: string) {
    try {
      const str = await this.load(`${ns}.#.${lib}`);
      return decode(str); // decode(null) will return null
    } catch (e) {
      return null;
    }
  }

  inited = false;

  async getNamespaceMetadata(namespace: string): Promise<NamespaceMetadata> {
    validateNamespace(namespace);
    const db = await this.dbPromise;
    const metadata = await db.get(NAMESPACE_STORE_NAME, namespace);
    if (metadata == null && namespace !== '#root') {
      const keys = await db.getAllKeys(this.storeName);
      if (!keys.some((key) => typeof key === 'string' && key.startsWith(`+${namespace}.`))) {
        throw new Error(`Missing namespace: ${namespace}`);
      }
    }
    return readNamespaceMetadata(metadata);
  }

  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata): Promise<void> {
    validateNamespace(namespace);
    await (await this.dbPromise).put(NAMESPACE_STORE_NAME, readNamespaceMetadata(metadata), namespace);
  }

  async listFlows(namespace: string): Promise<string[]> {
    validateNamespace(namespace);
    const result: string[] = [];
    for (const key of await (await this.dbPromise).getAllKeys(this.storeName)) {
      if (typeof key !== 'string') continue;
      const [ns, name] = splitFlowStorageKey(key);
      if ((ns || '#root') === namespace && name.split('.').every(validFlowEntry)) result.push(name);
    }
    return result.sort();
  }

  async init(root: Root) {
    const globalData = await this.loadFlow('#global');
    root.loadGlobal(globalData ?? {'#is': ''}, async (flow: Flow) => {
      const data = flow.save();
      await this.saveFlow(null, data, '#global');
      return data;
    });
    this.inited = true;
  }
}
