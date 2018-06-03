import { Connection, ConnectionSend } from "./Connection";
import { WatchObjectCallback, WatchValueCallback } from "./Watch";
import { Uid } from "../util/Uid";
import { DataMap, isSavedBlock } from "../util/Types";
import { Block } from "../block/Block";


interface ClientCallbacks {
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
      this._callbacks.onError(error, this._data);
    }
  }
}

class MergedClientRequest extends ConnectionSend implements ClientCallbacks {
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
    if (callbacks.onUpdate) {
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
    super.onUpdate(response);
  }
}

export class ClientConnection extends Connection {

  uid: Uid = new Uid();

  // id as key
  requests: { [key: string]: ClientCallbacks } = {};
  // path as key
  subscribes: { [key: string]: MergedClientRequest } = {};
  // path as key
  watches: { [key: string]: MergedClientRequest } = {};

  constructor() {
    super();
  }

  /* istanbul ignore next */
  disconnect(): void {
    // to be overridden
    throw new Error("not implemented");
  }

  destroy() {
    for (let key in this.requests) {
      this.requests[key].onError('disconnected');
    }
  }

  onData(response: DataMap) {
    if (typeof response.id === 'string' && this.requests.hasOwnProperty(response.id)) {
      switch (response.cmd) {
        case 'update': {
          this.requests[response.id].onUpdate(response);
          return;
        }
        case 'final': {
          this.requests[response.id].onUpdate(response);
          this.requests[response.id].onDone();
          break;
        }
        case 'error': {
          this.requests[response.id].onError(response.msg);
          break;
        }
        default: // 'done'
          this.requests[response.id].onDone();
      }
      delete this.requests[response.id];
    }
  }

  simpleRequest(data: DataMap, callbacks: ClientCallbacks) {
    let promise: Promise<void>;
    if (callbacks == null) {
      promise = new Promise(function (resolve, reject) {
        callbacks = {
          onDone: resolve, onError: reject
        };
      });
    }
    let id = this.uid.next();
    data.id = id;
    let req = new ClientRequest(data, callbacks);
    this.requests[id] = req;
    this.addSend(req);
    return promise;
  }

  setValue(path: string, value: any, callbacks?: ClientCallbacks) {
    return this.simpleRequest({cmd: 'set', path, value}, callbacks);
  }

  getValue(path: string, callbacks: ClientCallbacks): void {
    // TODO
  }

  updateValue(path: string, value: any, callbacks?: ClientCallbacks) {
    return this.simpleRequest({cmd: 'update', path, value}, callbacks);
  }

  setBinding(path: string, from: string, callbacks?: ClientCallbacks) {
    return this.simpleRequest({cmd: 'bind', path, from}, callbacks);
  }

  createBlock(path: string, callbacks?: ClientCallbacks) {
    return this.simpleRequest({cmd: 'create', path}, callbacks);
  }

  subscribe(path: string, callbacks: ClientCallbacks) {
    if (this.subscribes.hasOwnProperty(path)) {
      this.subscribes[path].add(callbacks);
    } else {
      let id = this.uid.next();
      let data = {cmd: 'subscribe', path, id};
      let req = new SubscribeRequest(data, callbacks);
      this.requests[id] = req;
      this.addSend(req);
    }
  }

  unsubscribe(path: string, callbacks: ClientCallbacks) {
    let req = this.subscribes[path];
    if (req) {
      req.remove(callbacks);
      if (req.isEmpty()) {
        let id = req._data.id;
        req._data = {cmd: 'close', id};
        this.addSend(req);
        delete this.subscribes[path];
        delete this.requests[id];
      }
    }
  }

  watchObject(path: string, callback: WatchObjectCallback): void {
    //
  }

  unwatchObject(path: string): void {
    //
  }

  watchProperty(path: string, fields: string[], callback: WatchValueCallback): void {
    //
  }

  unwatchProperty(path: string, fields: string[]): void {
    //
  }
}

