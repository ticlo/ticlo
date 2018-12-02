import {Connection, ConnectionSend} from "./Connection";
import {Uid} from "../util/Uid";
import {DataMap, isSavedBlock, measureObjSize} from "../util/Types";
import {Block} from "../block/Block";
import {FunctionDesc} from "../block/Descriptor";

export interface ClientCallbacks {
  onDone?(): void;

  onUpdate?(response: DataMap): void;

  onError?(error: string, data?: DataMap): void;
}

class ClientRequest extends ConnectionSend implements ClientCallbacks {

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

class MergedClientRequest extends ConnectionSend implements ClientCallbacks {
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

class SubscribeRequest extends MergedClientRequest {
  _cache: {
    value: any;
    bindingPath: string;
    hasListener: boolean
  } = {
    value: undefined,
    bindingPath: null,
    hasListener: false
  };


  add(callbacks: ClientCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({cache: {...this._cache}});
    }
  }

  onUpdate(response: DataMap): void {
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

class SetRequest extends ConnectionSend {
  path: string;
  conn: ClientConnection;

  constructor(path: string, value: any, id: string, conn: ClientConnection) {
    super({cmd: 'set', id, path, value});
    this.path = path;
    this.conn = conn;
  }

  update(value: any) {
    this._data.value = value;
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

class WatchRequest extends MergedClientRequest {
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

type DescListener = (desc: FunctionDesc) => void;

class DescRequest extends ConnectionSend implements ClientCallbacks {

  listeners: Map<DescListener, string> = new Map<DescListener, string>();

  cache: Map<string, FunctionDesc> = new Map<string, FunctionDesc>();

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
                if (id === lid) {
                  listener(null);
                }
              }
            }
          } else {
            this.cache.set(id, change);
            if (this.listeners.size) {
              for (let [listener, lid] of this.listeners) {
                if (id === lid) {
                  listener(change);
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

export class ClientConnection extends Connection {

  uid: Uid = new Uid();

  // id as key
  requests: Map<string, ClientCallbacks> = new Map();
  // path as key
  subscribes: Map<string, SubscribeRequest> = new Map();
  // path as key
  setRequests: Map<string, SetRequest> = new Map();
  // path as key
  watches: Map<string, WatchRequest> = new Map();

  descReq: DescRequest;


  constructor(watchDesc: boolean) {
    super();
    if (watchDesc) {
      let id = this.uid.next();
      let data = {cmd: 'watchDesc', path: '', id};
      this.descReq = new DescRequest(data);
      this.requests.set(id, this.descReq);
      this.addSend(this.descReq);
    }
  }

  /* istanbul ignore next */
  disconnect(): void {
    // to be overridden
    /* istanbul ignore next */
    throw new Error("not implemented");
  }

  destroy() {
    for (let [key, req] of this.requests) {
      req.onError('disconnected');
    }
    super.destroy();
  }

  onData(response: DataMap) {
    if (typeof response.id === 'string' && this.requests.has(response.id)) {
      switch (response.cmd) {
        case 'update': {
          this.requests.get(response.id).onUpdate(response);
          return;
        }
        case 'final': {
          let req = this.requests.get(response.id);
          req.onUpdate(response);
          req.onDone();
          break;
        }
        case 'error': {
          this.requests.get(response.id).onError(response.msg);
          break;
        }
        default: // 'done'
          this.requests.get(response.id).onDone();
      }
      this.requests.delete(response.id);
    }
  }

  simpleRequest(data: DataMap, callbacks: ClientCallbacks): Promise<any> | string {
    let promise: Promise<any>;
    if (callbacks == null) {
      promise = new Promise((resolve, reject) => {
        callbacks = {
          onDone: resolve, onUpdate: resolve, onError: reject
        };
      });
    }
    let id = this.uid.next();
    data.id = id;
    let req = new ClientRequest(data, callbacks);
    this.requests.set(id, req);
    this.addSend(req);
    if (promise) {
      return promise;
    }
    return id;
  }

  // important request will always be sent
  // unimportant request may be merged with other set request on same path
  setValue(path: string, value: any, important: boolean = false): Promise<any> | string {
    if (important) {
      if (this.setRequests.has(path)) {
        this.setRequests.get(path).cancel();
      }
      return this.simpleRequest({cmd: 'set', path, value}, null);
    }
    if (this.setRequests.has(path)) {
      let req = this.setRequests.get(path);
      req.update(value);
      return '';
    } else {
      let req = new SetRequest(path, value, this.uid.next(), this);
      this.setRequests.set(path, req);
      this.addSend(req);
      return '';
    }

  }

  getValue(path: string, callbacks: ClientCallbacks): Promise<any> | string {
    // TODO
    return this.simpleRequest({cmd: 'get', path}, callbacks);
  }

  updateValue(path: string, value: any, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'update', path, value}, callbacks);
  }

  setBinding(path: string, from: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'bind', path, from}, callbacks);
  }

  createBlock(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'create', path}, callbacks);
  }

  listChildren(path: string, filter?: string, max: number = 16, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'list', path, filter, max}, callbacks);
  }

  subscribe(path: string, callbacks: ClientCallbacks) {
    if (this.subscribes.has(path)) {
      this.subscribes.get(path).add(callbacks);
    } else {
      let id = this.uid.next();
      let data = {cmd: 'subscribe', path, id};
      let req = new SubscribeRequest(data, callbacks);
      this.requests.set(id, req);
      this.subscribes.set(path, req);
      this.addSend(req);
    }
  }

  unsubscribe(path: string, callbacks: ClientCallbacks) {
    let req = this.subscribes.get(path);
    if (req) {
      req.remove(callbacks);
      if (req.isEmpty()) {
        let id = req._data.id;
        req._data = {cmd: 'close', id};
        this.addSend(req);
        this.subscribes.delete(path);
        this.requests.delete(id);
      }
    }
  }

  watch(path: string, callbacks: ClientCallbacks) {
    if (this.watches.has(path)) {
      this.watches.get(path).add(callbacks);
    } else {
      let id = this.uid.next();
      let data = {cmd: 'watch', path, id};
      let req = new WatchRequest(data, callbacks);
      this.requests.set(id, req);
      this.watches.set(path, req);
      this.addSend(req);
    }
  }

  unwatch(path: string, callbacks: ClientCallbacks): void {
    let req = this.watches.get(path);
    if (req) {
      req.remove(callbacks);
      if (req.isEmpty()) {
        let id = req._data.id;
        req._data = {cmd: 'close', id};
        this.addSend(req);
        this.watches.delete(path);
        this.requests.delete(id);
      }
    }
  }

  cancel(id: string) {
    let req: DataMap = this.requests.get(id);
    if (req instanceof ClientRequest) {
      req.cancel();
      this.requests.delete(id);
    }
  }

  watchDesc(id: string, listener: DescListener) {
    this.descReq.listeners.set(listener, id);
    if (this.descReq.cache.has(id)) {
      listener(this.descReq.cache.get(id));
    } else {
      listener(null);
    }
  }

  unwatchDesc(listener: DescListener) {
    this.descReq.listeners.delete(listener);
  }


}
