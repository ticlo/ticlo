import {Connection} from './Connection';
import {Uid} from '../util/Uid';
import {DataMap} from '../util/DataTypes';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {
  ClientCallbacks,
  ClientRequest,
  ClientDescListener,
  DescRequest,
  GlobalWatch,
  SetRequest,
  SubscribeCallbacks,
  SubscribeRequest,
  WatchRequest,
  MergedClientRequest,
} from './ClientRequests';
import {ClientConn} from './ClientConn';
import {StreamDispatcher} from '../block/Dispatcher';
import {Query} from './Query';

export type {ValueUpdate, ValueState} from './ClientRequests';

export abstract class ClientConnection extends Connection implements ClientConn {
  static addEditorDescriptor(id: string, desc: FunctionDesc) {
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

  getBaseConn() {
    return this;
  }

  _childrenChangeStream = new StreamDispatcher<{path: string; showNode?: boolean}>();

  childrenChangeStream() {
    return this._childrenChangeStream;
  }

  onData(response: DataMap) {
    if (typeof response.id === 'string' && this.requests.has(response.id)) {
      if (response.cmd === 'update') {
        this.requests.get(response.id).onUpdate(response);
        return;
      }
      let req = this.requests.get(response.id);
      if (req instanceof SubscribeRequest) {
        if (this.subscribes.get(req._data.path as string) === req) {
          this.subscribes.delete(req._data.path as string);
        }
      } else if (req instanceof WatchRequest) {
        if (this.watches.get(req._data.path as string) === req) {
          this.watches.delete(req._data.path as string);
        }
      }

      this.requests.delete(response.id);
      switch (response.cmd) {
        case 'final': {
          req.onUpdate(response);
          req.onDone();
          break;
        }
        case 'error': {
          req.onError(String(response.msg));
          break;
        }
        default:
          // 'done'
          req.onDone();
      }
    }
  }

  simpleRequest(data: DataMap, callbacks: ClientCallbacks): Promise<any> | string {
    let promise: Promise<any>;
    if (callbacks == null) {
      promise = new Promise((resolve, reject) => {
        callbacks = {
          onDone: resolve,
          onUpdate: resolve,
          onError: reject,
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

  restoreSaved(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'restoreSaved', path}, callbacks);
  }

  setBinding(
    path: string,
    from: string,
    absolute = false,
    important: boolean | ClientCallbacks = false
  ): Promise<any> | string {
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
    return this.simpleRequest({cmd: 'get', path}, callbacks);
  }

  addBlock(path: string, data?: DataMap, anyName = false, callbacks?: ClientCallbacks): Promise<any> | string {
    let result = this.simpleRequest({cmd: 'addBlock', path, data, anyName}, callbacks);
    this._childrenChangeStream.dispatch({path: path.substring(0, path.lastIndexOf('.'))});
    return result;
  }

  addFlow(path: string, data?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string {
    let result = this.simpleRequest({cmd: 'addFlow', path, data}, callbacks);
    this._childrenChangeStream.dispatch({path: path.substring(0, path.lastIndexOf('.')), showNode: true});
    return result;
  }

  list(path: string, filter?: string, max: number = 16, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'list', path, filter, max}, callbacks);
  }

  query(path: string, query: Query, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'query', path, query}, callbacks);
  }

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue: boolean = false) {
    if (this.subscribes.has(path)) {
      let sub = this.subscribes.get(path);
      if (fullValue) {
        sub.addFull(callbacks);
      } else {
        sub.add(callbacks);
      }
    } else {
      let id = this.uid.next();
      let data = {cmd: 'subscribe', path, id, fullValue};
      let req = new SubscribeRequest(data, path, this);
      if (fullValue) {
        req.addFull(callbacks);
      } else {
        req.add(callbacks);
      }
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
        let id = String(req._data.id);
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
        let id = String(req._data.id);
        req._data = {cmd: 'close', id};
        this.addSend(req);
        this.watches.delete(path);
        this.requests.delete(id);
      }
    }
  }

  editWorker(
    path: string,
    fromField?: string,
    fromFunction?: string,
    defaultData?: DataMap,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'editWorker', path, fromField, fromFunction, defaultData}, callbacks);
  }

  applyFlowChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'applyFlowChange', path, funcId}, callbacks);
  }

  deleteFunction(funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest(
      {
        cmd: 'deleteFunction',
        path: '#', // just to prevent the invalid path error
        funcId,
      },
      callbacks
    );
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

  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'setLen', path, group, length}, callbacks);
  }

  renameProp(path: string, newName: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'renameProp', path, newName}, callbacks);
  }

  addCustomProp(
    path: string,
    desc: PropDesc | PropGroupDesc,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'addCustomProp', path, desc, group}, callbacks);
  }

  removeCustomProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeCustomProp', path, name, group}, callbacks);
  }

  moveCustomProp(
    path: string,
    nameFrom: string,
    nameTo: string,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveCustomProp', path, nameFrom, nameTo, group}, callbacks);
  }

  addOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'addOptionalProp', path, name}, callbacks);
  }

  removeOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeOptionalProp', path, name}, callbacks);
  }

  moveOptionalProp(path: string, nameFrom: string, nameTo: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveOptionalProp', path, nameFrom, nameTo}, callbacks);
  }

  insertGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'insertGroupProp', path, group, idx}, callbacks);
  }

  removeGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'removeGroupProp', path, group, idx}, callbacks);
  }

  moveGroupProp(
    path: string,
    group: string,
    oldIdx: number,
    newIdx: number,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'moveGroupProp', path, group, oldIdx, newIdx}, callbacks);
  }

  undo(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'undo', path}, callbacks);
  }

  redo(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'redo', path}, callbacks);
  }

  copy(path: string, props: string[], cut?: boolean, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'copy', path, props, cut}, callbacks);
  }

  executeCommand(path: string, command: string, params?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'executeCommand', path, command, params}, callbacks);
  }

  paste(
    path: string,
    data: DataMap,
    resolve?: 'overwrite' | 'rename',
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    return this.simpleRequest({cmd: 'paste', path, data, resolve}, callbacks);
  }

  callFunction(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this.simpleRequest({cmd: 'callFunction', path}, callbacks);
  }

  cancel(id: string) {
    let req = this.requests.get(id);
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
      return this.descReq.cache.get(id);
    }
    return null;
  }

  unwatchDesc(listener: ClientDescListener) {
    this.descReq.listeners.delete(listener);
  }

  getCategory(category: string): FunctionDesc {
    return this.descReq.categories.get(category);
  }

  // find the common base Desc
  getCommonBaseFunc(set: Set<FunctionDesc>): FunctionDesc {
    if (!set || set.size === 0) {
      return null;
    }
    if (set.size === 1) {
      return set[Symbol.iterator]().next().value;
    }
    let collected: FunctionDesc[];
    let commonMatch: number;
    for (let desc of set) {
      if (!collected) {
        // collect all bases from the first one
        collected = [];
        commonMatch = 0;
        do {
          collected.push(desc);
          if (desc.base) {
            desc = this.descReq.cache.get(desc.base);
          } else {
            break;
          }
        } while (desc);
      } else {
        // check if
        do {
          let match = collected.indexOf(desc);
          if (match >= 0) {
            if (match > commonMatch) {
              commonMatch = match;
            }
            break;
          }
          if (desc.base) {
            desc = this.descReq.cache.get(desc.base);
          } else {
            // no match and no base to check
            return null;
          }
        } while (desc);
      }
    }
    return collected[commonMatch];
  }

  getOptionalProps(desc: FunctionDesc): {[key: string]: PropDesc} {
    let result: {[key: string]: PropDesc};
    do {
      if (desc.optional) {
        if (result) {
          result = {...desc.optional, ...result};
        } else {
          result = desc.optional;
        }
      }
      if (desc.base) {
        desc = this.descReq.cache.get(desc.base);
      } else {
        break;
      }
    } while (desc);
    return result;
  }

  findGlobalBlocks(tags: string[]): string[] {
    let result: string[] = [];
    if (this.globalWatch && Array.isArray(tags)) {
      for (let [key, listener] of this.globalWatch.isListeners) {
        let funcDesc = this.watchDesc(listener.value);
        if (funcDesc && funcDesc.tags) {
          for (let tag of tags) {
            if (funcDesc.tags.includes(tag)) {
              result.push(key);
              break;
            }
          }
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
      this._reconnectTimeout = setTimeout(() => this.reconnect(), this._reconnectInterval * 1000);
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
