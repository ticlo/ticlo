import {Connection, ConnectionSend} from "./Connection";
import {Uid} from "../util/Uid";
import {DataMap, isSavedBlock, measureObjSize} from "../util/Types";
import {Block} from "../block/Block";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../block/Descriptor";
import {deepEqual} from "../util/Compare";
import {
  ClientCallbacks,
  ClientRequest,
  ClientDescListener,
  DescRequest,
  GlobalWatch,
  SetRequest, SubscribeCallbacks,
  SubscribeRequest,
  WatchRequest, MergedClientRequest
} from "./ClientRequests";

export {ValueUpdate, ValueState} from "./ClientRequests";

export abstract class ClientConnection extends Connection {

  static addEditorType(id: string, desc: FunctionDesc) {
    DescRequest.editorCache.set(id, desc);
  }

  uid: Uid = new Uid();

  // id as key
  requests: Map<string, ClientCallbacks> = new Map();
  // path as key
  subscribes: Map<string, SubscribeRequest> = new Map();
  // path as key
  setRequests: Map<string, SetRequest> = new Map();
  // path as key
  watches: Map<string, WatchRequest> = new Map();

  readonly descReq: DescRequest;
  readonly globalWatch: GlobalWatch;


  constructor(editorListeners: boolean) {
    super();
    if (editorListeners) {
      // watchDesc
      let id = this.uid.next();
      let data = {cmd: 'watchDesc', path: '', id};
      this.descReq = new DescRequest(data);
      this.requests.set(id, this.descReq);
      this.addSend(this.descReq);

      // watch #global
      this.globalWatch = new GlobalWatch(this);
      this.watch('#global', this.globalWatch);
    }
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
  setValue(path: string, value: any, important: boolean | ClientCallbacks = false): Promise<any> | string {
    if (important) {
      if (this.setRequests.has(path)) {
        this.setRequests.get(path).cancel();
      }
      if (typeof important === 'object') {
        return this.simpleRequest({cmd: 'set', path, value}, important);
      } else {
        return this.simpleRequest({cmd: 'set', path, value}, null);
      }
    }
    if (this.setRequests.has(path)) {
      let req = this.setRequests.get(path);
      req.updateSet(value);
      return '';
    } else {
      let req = new SetRequest(path, this.uid.next(), this);
      req.updateSet(value);
      this.setRequests.set(path, req);
      this.addSend(req);
      return '';
    }
  }

  updateValue(path: string, value: any, important: boolean | ClientCallbacks = false): Promise<any> | string {
    // return this.simpleRequest({cmd: 'update', path, value}, callbacks);
    if (important) {
      if (this.setRequests.has(path)) {
        this.setRequests.get(path).cancel();
      }
      if (typeof important === 'object') {
        return this.simpleRequest({cmd: 'update', path, value}, important);
      } else {
        return this.simpleRequest({cmd: 'update', path, value}, null);
      }
    }
    if (this.setRequests.has(path)) {
      let req = this.setRequests.get(path);
      req.updateUpdate(value);
      return '';
    } else {
      let req = new SetRequest(path, this.uid.next(), this);
      req.updateUpdate(value);
      this.setRequests.set(path, req);
      this.addSend(req);
      return '';
    }
  }

  setBinding(path: string, from: string, absolute = false, important: boolean | ClientCallbacks = false): Promise<any> | string {
    // return this.simpleRequest({cmd: 'bind', path, from}, callbacks);
    if (important) {
      if (this.setRequests.has(path)) {
        this.setRequests.get(path).cancel();
      }
      let request: any = {cmd: 'bind', path, absolute, from};
      if (typeof important === 'object') {
        return this.simpleRequest(request, important);
      } else {
        return this.simpleRequest(request, null);
      }
    }
    if (this.setRequests.has(path)) {
      let req = this.setRequests.get(path);
      req.updateBind(from, absolute);
      return '';
    } else {
      let req = new SetRequest(path, this.uid.next(), this);
      req.updateBind(from, absolute);
      this.setRequests.set(path, req);
      this.addSend(req);
      return '';
    }
  }

  getValue(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    // TODO
    return this.simpleRequest({cmd: 'get', path}, callbacks);
  }


  createBlock(path: string, data?: DataMap, anyName = false, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'create', path, data, anyName}, callbacks);
  }

  listChildren(path: string, filter?: string, max: number = 16, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'list', path, filter, max}, callbacks);
  }

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue: boolean = false) {
    if (this.subscribes.has(path)) {
      let sub = this.subscribes.get(path);
      sub.add(callbacks);
      if (fullValue && !sub._data.fullValue) {
        sub._data.fullValue = true;
        this.addSend(sub); // resend the request
      }
    } else {
      let id = this.uid.next();
      let data = {cmd: 'subscribe', path, id, fullValue};
      let req = new SubscribeRequest(data, callbacks);
      this.requests.set(id, req);
      this.subscribes.set(path, req);
      this.addSend(req);
    }
  }

  unsubscribe(path: string, callbacks: SubscribeCallbacks) {
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

  editJob(path: string, fromField?: string, fromFunction?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'editJob', path, fromField, fromFunction}, callbacks);
  }

  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'showProps', path, props}, callbacks);
  }

  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'hideProps', path, props}, callbacks);
  }

  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveShownProp', path, propFrom, propTo}, callbacks);
  }

  setLen(path: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'setLen', path, length}, callbacks);
  }

  addMoreProp(path: string, desc: PropDesc | PropGroupDesc, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'addMoreProp', path, desc, group}, callbacks);
  }

  removeMoreProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeMoreProp', path, name, group}, callbacks);
  }

  moveMoreProp(path: string, nameFrom: string, nameTo: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveMoreProp', path, nameFrom, nameTo, group}, callbacks);
  }

  cancel(id: string) {
    let req: DataMap = this.requests.get(id);
    if (req instanceof ClientRequest) {
      req.cancel();
      this.requests.delete(id);
    }
  }

  watchDesc(id: string, listener?: ClientDescListener): FunctionDesc {
    if (listener) {
      this.descReq.listeners.set(listener, id);
      if (id === '*') {
        // listen to all descs
        for (let [id, desc] of this.descReq.cache) {
          listener(desc, id);
        }
      } else if (this.descReq.cache.has(id)) {
        listener(this.descReq.cache.get(id), id);
      } else {
        listener(null, id);
      }

    } else {
      if (this.descReq.cache.has(id)) {
        return this.descReq.cache.get(id);
      }
    }
    return null;
  }

  unwatchDesc(listener: ClientDescListener) {
    this.descReq.listeners.delete(listener);
  }

  findGlobalBlocks(types: string[]): string[] {
    let result: string[] = [];
    if (this.globalWatch && Array.isArray(types)) {
      for (let [key, listener] of this.globalWatch.isListeners) {
        if (types.includes(listener.value)) {
          result.push(key);
        }
      }
    }
    return result;
  }

  abstract reconnect(): void;

  _reconnectInterval = 1;
  _reconnectTimeout: any;

  onConnect() {
    super.onConnect();
    // TODO: add some delay to make sure the connection is correct
    this._reconnectInterval = 1;
  }

  onDisconnect() {
    super.onDisconnect();
    // remove requests from the map
    // or notify the disconnection
    for (let [key, req] of this.requests) {
      if (req instanceof MergedClientRequest) {
        req.onDisconnect();
        this.addSend(req);
      } else if (req === this.descReq) {
        this.descReq.onDisconnect();
        this.addSend(this.descReq);
      } else {
        req.onError('disconnected');
        this.requests.delete(key);
        this._sending.delete(req as any);
      }
    }
    if (!this._destroyed) {
      // reconnect after N seconds, N = 1,2,3,4 ... 60
      this._reconnectTimeout = setTimeout(
        () => this.reconnect(),
        this._reconnectInterval * 1000
      );
      if (this._reconnectInterval < 60) {
        this._reconnectInterval++;
      }
    }
  }

  destroy() {
    for (let [key, req] of this.requests) {
      req.onError('disconnected');
    }
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
    }
    super.destroy();
  }
}
