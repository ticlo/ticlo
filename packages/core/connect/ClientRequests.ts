import {DataMap, isDataMap, isDataTruncated, measureObjSize, WS_FRAME_SIZE} from '../util/DataTypes';
import {ConnectionSend} from './Connection';
import {FunctionDesc, mapConfigDesc} from '../block/Descriptor';
import {ClientConnection} from './ClientConnection';
import {clientDescriptors} from './ClientDescriptors';

export interface ClientCallbacks {
  // parameter should not be used
  onDone?(_?: unknown): void;

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
    this._callbacks.onDone?.();
  }

  onUpdate(response: DataMap): void {
    this._callbacks.onUpdate?.(response);
  }

  onError(error: string, data?: DataMap): void {
    this._callbacks.onError?.(error, data || this._data);
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
    if (callbacks) {
      this._callbackSet.add(callbacks);
    }
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
      callbacks.onDone?.();
    }
  }

  onUpdate(response: DataMap): void {
    for (let callbacks of this._callbackSet) {
      if (callbacks.onUpdate) {
        callbacks.onUpdate(response);
      }
    }
    this._disconnectd = false;
  }

  onError(error: string): void {
    for (let callbacks of this._callbackSet) {
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  }

  _disconnectd = false;

  onDisconnect() {
    this._disconnectd = true;
  }
}

export interface ValueState {
  value?: any;
  // whether value is same as saved value
  temp?: boolean;
  // whether value is undefined
  undefined?: boolean;
  bindingPath?: string;
  hasListener?: boolean;
}

export interface ValueUpdate extends DataMap {
  cache: ValueState;
  change?: ValueState;
}

export interface SubscribeCallbacks extends ClientCallbacks {
  onDone?(): void;

  onUpdate?(response: ValueUpdate): void;

  onError?(error: string, data?: DataMap): void;
}

const defaultValueState: ValueState = {
  value: undefined,
  bindingPath: null,
  hasListener: false,
};

export class SubscribeRequest extends MergedClientRequest {
  _cache: ValueState = {...defaultValueState};

  constructor(
    data: DataMap,
    public path: string,
    public conn: ClientConnection
  ) {
    super(data, null);
  }

  add(callbacks: SubscribeCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({cache: {...this._cache}, change: this._cache});
    }
  }

  onUpdate(response: ValueState): void {
    if (this._disconnectd) {
      // after disconnect, server might not be aware of these changes, fill in them in client side
      if (this._cache.value !== undefined && !Object.hasOwn(response, 'value')) {
        response.value = undefined;
      }
      if (this._cache.temp && !Object.hasOwn(response, 'temp')) {
        response.temp = undefined;
      }
      if (this._cache.bindingPath != null && !Object.hasOwn(response, 'bindingPath')) {
        response.bindingPath = null;
      }
      if (this._cache.hasListener && !Object.hasOwn(response, 'hasListener')) {
        response.hasListener = false;
      }
      this._cache = {...defaultValueState};
      // TODO : add a disconnected event in the update
    }

    let valueChanged = false;
    if (response.undefined) {
      response.value = undefined;
    }
    if (Object.hasOwn(response, 'value')) {
      this._cache.value = response.value;
      this._cache.temp = response.temp;
      valueChanged = true;
    }
    if (Object.hasOwn(response, 'bindingPath')) {
      this._cache.bindingPath = response.bindingPath;
    }
    if (Object.hasOwn(response, 'hasListener')) {
      this._cache.hasListener = response.hasListener;
    }
    this._hasUpdate = true;
    super.onUpdate({cache: {...this._cache}, change: response});
    if (this._fullCallbackSet.size) {
      if (valueChanged && isDataTruncated(response.value)) {
        this.loadFullValue();
      } else if (Object.hasOwn(response, 'value')) {
        this._cachedFullValue = response.value;
        this.updateFullValue();
      }
    }
  }

  _fullCallbackSet: Set<ClientCallbacks> = new Set();
  _getValuePromise: Promise<any>;
  _cachedFullValue: any;

  addFull(callbacks: SubscribeCallbacks) {
    let pendingLoad = this._fullCallbackSet.size === 0;
    this._fullCallbackSet.add(callbacks);
    if (pendingLoad) {
      this.loadFullValue();
    } else {
      if (callbacks.onUpdate) {
        callbacks.onUpdate({cache: {...this._cache, value: this._cachedFullValue}});
      }
    }
  }

  remove(callbacks: SubscribeCallbacks) {
    if (this._fullCallbackSet.has(callbacks)) {
      this._fullCallbackSet.delete(callbacks);
      if (this._fullCallbackSet.size === 0) {
        this._cachedFullValue = undefined;
      }
    } else {
      super.remove(callbacks);
    }
  }

  isEmpty(): boolean {
    return super.isEmpty() && this._fullCallbackSet.size === 0;
  }

  loadFullValue() {
    if (!this._getValuePromise) {
      this._getValuePromise = this.conn.getValue(this.path);
      this._getValuePromise.then((response) => {
        this._getValuePromise = null;
        this._cachedFullValue = response.value;
        this.updateFullValue();
      });
    }
  }

  updateFullValue() {
    for (let callbacks of this._fullCallbackSet) {
      if (callbacks.onUpdate) {
        callbacks.onUpdate({cache: {...this._cache, value: this._cachedFullValue}});
      }
    }
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

  getSendingData(): {data: DataMap; size: number} {
    if (this.conn) {
      this.conn.setRequests.delete(this.path);
      this.conn = null;
    }
    const size = measureObjSize(this._data, WS_FRAME_SIZE);
    if (size > WS_FRAME_SIZE && this.conn._sendLargeData(this._data)) {
      // TODO, handle in rest api
      return {data: null, size: 0};
    }
    return {data: this._data, size};
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
      callbacks.onUpdate({
        changes: this._cachedMap,
        cache: {...this._cachedMap},
      });
    }
  }

  onUpdate(response: DataMap): void {
    if (this._disconnectd) {
      // after disconnect, server might not be aware of these changes, fill in them in client side
      let changes = response.changes;
      if (isDataMap(changes)) {
        for (let name in this._cachedMap) {
          if (!Object.hasOwn(changes, name)) {
            changes[name] = null;
          } else if (changes[name] === this._cachedMap[name]) {
            delete changes[name];
          }
        }
      }
    }
    if (Object.isExtensible(response.changes)) {
      let changes = response.changes;
      if (isDataMap(changes)) {
        for (let key in changes) {
          let id = changes[key];
          if (id == null) {
            delete this._cachedMap[key];
          } else if (typeof id === 'string') {
            this._cachedMap[key] = id;
          }
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

  categories: Map<string, FunctionDesc> = new Map<string, FunctionDesc>(DescRequest.editorCache);
  cache: Map<string, FunctionDesc> = new Map<string, FunctionDesc>(DescRequest.editorCache);

  constructor(data: DataMap) {
    super(data);
  }

  onDone(): void {}

  onUpdate(response: DataMap): void {
    if (Array.isArray(response.changes)) {
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
            // convert string to config descriptor
            (change as FunctionDesc).configs = mapConfigDesc((change as FunctionDesc).configs);
            if (id.endsWith(':')) {
              this.categories.set(id.substring(0, id.length - 1), change);
            }
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

  onError(error: string, data?: DataMap): void {}

  onDisconnect() {
    this.cache = new Map<string, FunctionDesc>(DescRequest.editorCache);
  }
}

class GlobalTypeListener {
  value: any;

  onUpdate(response: ValueUpdate) {
    this.value = response.cache.value;
  }
}

/**
 * list global objects
 */
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

for (let desc of clientDescriptors) {
  DescRequest.editorCache.set(desc.id, desc);
}
