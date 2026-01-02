import {StatefulFunction, BaseFunction, PureFunction} from '../../block/BlockFunction.js';
import {globalFunctions} from '../../block/Functions.js';
import {Storage, voidStorage} from '../../block/Storage.js';
import {encode, decode} from '../../util/Serialize.js';
import {BlockIO} from '../../block/BlockProperty.js';

let storageInstance: Storage = voidStorage;
export function setStorageFunctionProvider(getStorage: () => Storage) {
  if (storageInstance == null || storageInstance === voidStorage) {
    storageInstance = getStorage();
  }
}

export class WriteStorageFunction extends BaseFunction {
  run() {
    const key = this._data.getValue('key');
    if (key && typeof key === 'string') {
      const value = this._data.getValue('input');
      if (value !== undefined) {
        if (value === null) {
          // delete key when value is null
          storageInstance.delete(key);
        } else {
          const encoded = encode(value);
          storageInstance.save(key, encoded);
        }
        return;
      }
    }
    // todo: return something different if not successful?
  }
}

globalFunctions.add(WriteStorageFunction, {
  name: 'write-storage',
  icon: 'fas:file-arrow-up',
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
  private _updateListener(key: unknown, autoRefresh: unknown) {
    if (autoRefresh && key && typeof key === 'string') {
      if (key !== this._listeningKey) {
        if (this._listeningKey) {
          storageInstance.unlisten(this._listeningKey, this._storageCallback);
        }
        this._listeningKey = key;
        storageInstance.listen(key, this._storageCallback);
      }
    } else {
      if (this._listeningKey) {
        storageInstance.unlisten(this._listeningKey, this._storageCallback);
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
      const str = await storageInstance.load(key);
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
      storageInstance.unlisten(this._listeningKey, this._storageCallback);
      this._listeningKey = null;
    }
    super.destroy();
  }
}

globalFunctions.add(ReadStorageFunction, {
  name: 'read-storage',
  icon: 'fas:file-arrow-down',
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
