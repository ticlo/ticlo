import {DataMap, measureObjSize} from "../util/Types";
import {ConnectionSend} from "./Connection";
import {FunctionDesc} from "../block/Descriptor";
import {ClientConnection} from "./ClientConnection";

export interface ClientCallbacks {
  onDone?(): void;

  onUpdate?(response: DataMap): void;

  onError?(error: string, data?: DataMap): void;
}

export class ClientRequest extends ConnectionSend implements ClientCallbacks {

  _callbacks: ClientCallbacks;

  constructor(data: DataMap, callbacks: ClientCallbacks) {
    super(data);
    this._callbacks = callbacks;
  }

  onDone(): void {
    if (this._callbacks.onDone) {
      this._callbacks.onDone();
    }
  }

  onUpdate(response: DataMap): void {
    if (this._callbacks.onUpdate) {
      this._callbacks.onUpdate(response);
    }
  }

  onError(error: string, data?: DataMap): void {
    if (this._callbacks.onError) {
      this._callbacks.onError(error, data || this._data);
    }
  }

  cancel() {
    this._data = null;
  }
}

export class MergedClientRequest extends ConnectionSend implements ClientCallbacks {
  _hasUpdate: boolean = false;
  _callbackSet: Set<ClientCallbacks> = new Set();

  constructor(data: DataMap, callbacks: ClientCallbacks) {
    super(data);
    this._callbackSet.add(callbacks);
  }

  add(callbacks: ClientCallbacks) {
    this._callbackSet.add(callbacks);
  }

  remove(callbacks: ClientCallbacks) {
    this._callbackSet.delete(callbacks);
  }

  isEmpty(): boolean {
    return this._callbackSet.size === 0;
  }

  onDone(): void {
    for (let callbacks of this._callbackSet) {
      if (callbacks.onDone) {
        callbacks.onDone();
      }
    }
  }

  onUpdate(response: DataMap): void {
    for (let callbacks of this._callbackSet) {
      if (callbacks.onUpdate) {
        callbacks.onUpdate(response);
      }
    }
  }

  onError(error: string): void {
    for (let callbacks of this._callbackSet) {
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  }
}

export interface ValueState {
  value?: any;
  bindingPath?: string;
  hasListener?: boolean;
}

export interface ValueUpdate {
  cache: ValueState;
  change: ValueState;
}

export interface SubscribeCallbacks {
  onDone?(): void;

  onUpdate?(response: ValueUpdate): void;

  onError?(error: string, data?: DataMap): void;
}

export class SubscribeRequest extends MergedClientRequest {
  _cache: ValueState = {
    value: undefined,
    bindingPath: null,
    hasListener: false
  };

  add(callbacks: SubscribeCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({cache: {...this._cache}, change: this._cache});
    }
  }

  onUpdate(response: ValueState): void {
    if (response.hasOwnProperty('value')) {
      this._cache.value = response.value;
    }
    if (response.hasOwnProperty('bindingPath')) {
      this._cache.bindingPath = response.bindingPath;
    }
    if (response.hasOwnProperty('hasListener')) {
      this._cache.hasListener = response.hasListener;
    }
    this._hasUpdate = true;
    super.onUpdate({cache: {...this._cache}, change: response});
  }
}

export class SetRequest extends ConnectionSend {
  path: string;
  conn: ClientConnection;

  constructor(path: string, id: string, conn: ClientConnection) {
    super({cmd: 'set', id, path});
    this.path = path;
    this.conn = conn;
  }

  updateSet(value: any) {
    delete this._data.from;
    delete this._data.absolute;
    this._data.cmd = 'set';
    this._data.value = value;
  }

  updateUpdate(value: any) {
    delete this._data.from;
    delete this._data.absolute;
    this._data.cmd = 'update';
    this._data.value = value;
  }

  updateBind(from: string, absolute: boolean) {
    delete this._data.value;
    this._data.cmd = 'bind';
    this._data.from = from;
    this._data.absolute = absolute;
  }

  getSendingData(): {data: DataMap, size: number} {
    if (this.conn) {
      this.conn.setRequests.delete(this.path);
      this.conn = null;
    }
    return {data: this._data, size: measureObjSize(this._data, 0x80000)};
  }

  cancel() {
    if (this.conn) {
      this.conn.setRequests.delete(this.path);
      this.conn = null;
    }
    this._data = null;
  }
}

export class WatchRequest extends MergedClientRequest {
  _cachedMap: {[key: string]: string} = {};

  add(callbacks: ClientCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({changes: this._cachedMap, cache: {...this._cachedMap}});
    }
  }

  onUpdate(response: DataMap): void {
    if (Object.isExtensible(response.changes)) {
      let map = response.changes;
      for (let key in map) {
        let id = map[key];
        if (id == null) {
          delete this._cachedMap[key];
        } else {
          this._cachedMap[key] = id;
        }
      }
    }
    this._hasUpdate = true;
    super.onUpdate({...response, cache: {...this._cachedMap}});
  }
}

export type ClientDescListener = (desc: FunctionDesc, id: string) => void;

export class DescRequest extends ConnectionSend implements ClientCallbacks {

  static editorCache: Map<string, FunctionDesc> = new Map<string, FunctionDesc>();

  listeners: Map<ClientDescListener, string> = new Map<ClientDescListener, string>();

  cache: Map<string, FunctionDesc> = new Map<string, FunctionDesc>(DescRequest.editorCache);

  constructor(data: DataMap) {
    super(data);
  }

  onDone(): void {

  }

  onUpdate(response: DataMap): void {
    if (response.changes) {
      for (let change of response.changes) {
        if (change && 'id' in change) {
          let id = change.id;
          if ('removed' in change) {
            this.cache.delete(id);
            if (this.listeners.size) {
              for (let [listener, lid] of this.listeners) {
                if (lid === '*' || id === lid) {
                  listener(null, id);
                }
              }
            }
          } else {
            this.cache.set(id, change);
            if (this.listeners.size) {
              for (let [listener, lid] of this.listeners) {
                if (lid === '*' || id === lid) {
                  listener(change, id);
                }
              }
            }
          }
        }
      }
    }
  }

  onError(error: string, data?: DataMap): void {

  }

  cancel() {
    this._data = null;
  }
}

class GlobalTypeListener {
  value: any;

  onUpdate(response: ValueUpdate) {
    this.value = response.cache.value;
  }
}

export class GlobalWatch {
  isListeners: Map<string, GlobalTypeListener> = new Map<string, GlobalTypeListener>();

  conn: ClientConnection;

  constructor(conn: ClientConnection) {
    this.conn = conn;
  }

  onUpdate(response: DataMap) {
    let changes: {[key: string]: any} = response.changes;
    for (let name in changes) {
      if (name.startsWith('^')) {
        let value = changes[name];
        if (value != null) {
          if (!this.isListeners.has(name)) {
            let listener = new GlobalTypeListener();
            this.isListeners.set(name, listener);
            this.conn.subscribe(`#global.${name}.#is`, listener);
          }
        } else {
          if (this.isListeners.has(name)) {
            this.conn.subscribe(`#global.${name}.#is`, this.isListeners.get(name));
            this.isListeners.delete(name);
          }
        }
      }
    }
  }

}