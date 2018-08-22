import {Connection, ConnectionSend} from "./Connection";
import {Uid} from "../util/Uid";
import {DataMap, isSavedBlock} from "../util/Types";
import {Block} from "../block/Block";

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
  _cachedValue: any;
  _cachedBinding: string;

  add(callbacks: ClientCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({value: this._cachedValue, bindingPath: this._cachedBinding, events: []});
    }
  }

  onUpdate(response: DataMap): void {
    if (response.hasOwnProperty('value')) {
      this._cachedValue = response.value;
    }
    if (response.hasOwnProperty('bindingPath')) {
      this._cachedBinding = response.bindingPath;
    }
    this._hasUpdate = true;
    super.onUpdate(response);
  }
}

class WatchRequest extends MergedClientRequest {
  _cachedMap: {[key: string]: string} = {};

  add(callbacks: ClientCallbacks) {
    super.add(callbacks);
    if (callbacks.onUpdate && this._hasUpdate) {
      callbacks.onUpdate({changes: this._cachedMap, cache: this._cachedMap});
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
    super.onUpdate({...response, cache: this._cachedMap});
  }
}

export class ClientConnection extends Connection {

  uid: Uid = new Uid();

  // id as key
  requests: Map<string, ClientCallbacks> = new Map();
  // path as key
  subscribes: Map<string, SubscribeRequest> = new Map();
  // path as key
  watches: Map<string, WatchRequest> = new Map();

  constructor() {
    super();
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
          this.requests.get(response.id).onUpdate(response);
          this.requests.get(response.id).onDone();
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

  setValue(path: string, value: any, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'set', path, value}, callbacks);
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

  _isCanceled(data: DataMap): boolean {
    return data.cmd !== 'close' && this.requests.get(data.id) === undefined;
  }

  cancel(id: string) {
    let req: DataMap = this.requests.get(id);
    if (req && req.cmd !== 'subscribe' && req.cmd !== 'watch') {
      this.requests.delete(id);
    }
  }
}
