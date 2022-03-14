import {openDB, deleteDB, wrap, unwrap, IDBPDatabase} from 'idb';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, Storage} from '../../../src/core';
import {WorkerFunction} from '../../../src/core/worker/WorkerFunction';
import {FlowLoader, FlowState} from '../../../src/core/block/Flow';

export class IndexDbStorage implements Storage {
  dbPromise: Promise<IDBPDatabase>;

  constructor(dbName: string = 'ticlo') {
    (async () => {
      this.dbPromise = openDB(dbName, undefined, {
        upgrade(db, oldVersion, newVersion, transaction) {
          db.createObjectStore('flows');
        },
        blocked() {},
        blocking() {},
        terminated() {},
      });
    })();
  }

  getFlowLoader(name: string, prop: BlockProperty): FlowLoader {
    return {
      applyChange: (data: DataMap) => {
        this.saveFlow(name, null, data);
        return true;
      },
      onStateChange: (flow: Flow, state: FlowState) => this.flowStateChanged(flow, name, state),
    };
  }

  flowStateChanged(flow: Flow, name: string, state: FlowState) {
    switch (state) {
      case FlowState.destroyed:
        this.deleteFlow(name);
        break;
    }
  }

  async deleteFlow(name: string) {
    await (await this.dbPromise).delete('flows', name);
  }

  async saveFlow(name: string, flow: Flow, data?: DataMap) {
    if (!data) {
      data = flow.save();
    }
    let str = encodeSorted(data);
    await (await this.dbPromise).put('flows', str, name);
  }

  async loadFlow(name: string) {
    try {
      let str = await (await this.dbPromise).get('flows', name);
      return decode(str);
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
    for (let storeKey of (await db.getAllKeys('flows')) as string[]) {
      if (
        !storeKey.includes('.#') // Do not load subflow during initialization.
      ) {
        if (storeKey === '#global') {
          try {
            globalData = decode(await db.get('flows', storeKey));
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
    console.log(functionFiles);
    console.log(flowFiles);

    // load custom types
    for (let name of functionFiles.sort()) {
      try {
        let data = decode(await db.get('flows', `#.${name}`));
        let desc = WorkerFunction.collectDesc(`:${name}`, data);
        WorkerFunction.registerType(data, desc, '');
      } catch (err) {
        // TODO Logger
      }
    }

    // load global block
    root._globalRoot.load(globalData, null, (saveData: DataMap) => {
      this.saveFlow('#global', root._globalRoot, saveData);
      return true;
    });

    // load flow entries
    // sort the name to make sure parent Flow is loaded before children flows
    for (let name of flowFiles.sort()) {
      try {
        let data = decode(await (await this.dbPromise).get('flows', name));
        root.addFlow(name, data);
      } catch (err) {
        // TODO Logger
      }
    }
    this.inited = true;
  }
}
