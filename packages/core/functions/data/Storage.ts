import {BaseFunction} from '../../block/BlockFunction.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import type {Storage} from '../../block/Storage.ts';
import {encode, decode} from '../../util/Serialize.ts';
import {BlockIO} from '../../block/BlockProperty.ts';
import {Namespace} from '../../block/Namespace.ts';
import {MemoryValueStorage} from '../../storage/MemoryValueStorage.ts';
import type {FunctionData} from '../../block/FunctonData.ts';

let storageInstance: Storage = new MemoryValueStorage();
export function setStorageFunctionProvider(getStorage: () => Storage) {
  storageInstance = getStorage();
}

function getStorage(data: FunctionData): Storage {
  const flow = data.getProperty('key', false)?._block?._flow;
  return (
    (flow && Namespace.rootOf(flow)._storage?.getValueStorage?.(flow._namespace?.slice(1) || '#root')) ??
    storageInstance
  );
}

export class WriteStorageFunction extends BaseFunction {
  run() {
    const key = this._data.getValue('key');
    if (key && typeof key === 'string') {
      const value = this._data.getValue('input');
      if (value !== undefined) {
        if (value === null) {
          // delete key when value is null
          return getStorage(this._data).delete(key);
        } else {
          const encoded = encode(value);
          return getStorage(this._data).save(key, encoded);
        }
      }
    }
    // todo: return something different if not successful?
  }
}

globalFunctions.addFactory(WriteStorageFunction, {
  name: 'write-storage',
  icon: 'svg:file-arrow-up',
  mode: 'onCall',
  priority: 3,
  properties: [
    {name: 'key', type: 'string', pinned: true},
    {name: 'input', type: 'any', pinned: true},
  ],
  category: 'data',
  color: '1bb',
});

export class ReadStorageFunction extends BaseFunction {
  private _listeningKey: string = null;
  private _storage: Storage;
  private _updateListener(key: unknown, autoRefresh: unknown) {
    if (autoRefresh && key && typeof key === 'string') {
      if (key !== this._listeningKey) {
        if (this._listeningKey) {
          this._storage.unlisten(this._listeningKey, this._storageCallback);
        }
        this._listeningKey = key;
        this._storage = getStorage(this._data);
        this._storage.listen(key, this._storageCallback);
      }
    } else {
      if (this._listeningKey) {
        this._storage.unlisten(this._listeningKey, this._storageCallback);
        this._listeningKey = null;
      }
    }
  }
  private _storageCallback = (value: string) => {
    this._data.output(decode(value));
  };

  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name === 'key' || input._name === 'autoRefresh') {
      this._updateListener(this._data.getValue('key'), this._data.getValue('autoRefresh'));
    }
    return true;
  }
  async run() {
    const key = this._data.getValue('key');
    if (key && typeof key === 'string') {
      const str = await getStorage(this._data).load(key);
      if (str) {
        this._data.output(decode(str));
      } else {
        this._data.output(undefined);
      }
    }
    // todo: return something different if not successful?
  }

  destroy() {
    if (this._listeningKey) {
      this._storage.unlisten(this._listeningKey, this._storageCallback);
      this._listeningKey = null;
    }
    super.destroy();
  }
}

globalFunctions.addFactory(ReadStorageFunction, {
  name: 'read-storage',
  icon: 'svg:file-arrow-down',
  mode: 'onLoad',
  priority: 1,
  properties: [
    {name: 'autoRefresh', type: 'toggle'},
    {name: 'key', type: 'string', pinned: true},
    {name: '#output', type: 'any', readonly: true, pinned: true},
  ],
  category: 'data',
  color: '1bb',
});
