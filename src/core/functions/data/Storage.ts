import {BlockFunction, PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {Storage} from '../../block/Storage';
import {encode, decode} from '../../util/Serialize';
import {BlockIO} from '../../block/BlockProperty';

let storageInstance: Storage;
export function setDefaultStorageFunctionProvider(getStorage: () => Storage) {
  if (storageInstance == null) {
    storageInstance = getStorage();
  }
}

export class WriteStorageFunction extends PureFunction {
  run() {
    const key = this._data.getValue('key');
    if (key && typeof key === 'string') {
      const value = this._data.getValue('input');
      if (value !== undefined) {
        const encoded = encode(value);
        storageInstance.save(key, encoded);
        return;
      }
    }
    // todo: return something different if not successful?
  }
}

Functions.add(WriteStorageFunction, {
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

export class ReadStorageFunction extends BlockFunction {
  #listeningKey: string = null;
  #updateListener(key: unknown, autoRefresh: unknown) {
    if (autoRefresh && key && typeof key === 'string') {
      if (key !== this.#listeningKey) {
        if (this.#listeningKey) {
          storageInstance.unlisten(this.#listeningKey, this.#storageCallback);
        }
        this.#listeningKey = key;
        storageInstance.listen(key, this.#storageCallback);
      }
    } else {
      if (this.#listeningKey) {
        storageInstance.unlisten(this.#listeningKey, this.#storageCallback);
        this.#listeningKey = null;
      }
    }
  }
  #storageCallback = (value: string) => {
    this._data.output(decode(value));
  };

  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name === 'key' || input._name === 'autoRefresh') {
      this.#updateListener(this._data.getValue('key'), this._data.getValue('autoRefresh'));
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
    if (this.#listeningKey) {
      storageInstance.unlisten(this.#listeningKey, this.#storageCallback);
      this.#listeningKey = null;
    }
    super.destroy();
  }
}

Functions.add(ReadStorageFunction, {
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
