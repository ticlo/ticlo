import {Connection, ConnectionSendingData} from './Connection.ts';
import {Uid} from '../util/Uid.ts';
import {DataMap} from '../util/DataTypes.ts';
import {FunctionDesc, PropDesc} from '../block/Descriptor.ts';
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
} from './ClientRequests.ts';
import {ClientConn} from './ClientConn.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';
import {updateGlobalSettings} from '../util/Settings.ts';
import {DataWrapper} from '../block/FunctonData.ts';
import {checkEditPolicy, type EditPolicy, EditPolicyView} from '../policy/EditPolicy.ts';
import {PolicyConnection} from './PolicyConnection.ts';
import {NoSerialize} from '../util/NoSerialize.ts';

export type {ValueUpdate, ValueState} from './ClientRequests.ts';

export abstract class ClientConnection extends ClientConn {
  private readonly transport = new ClientTransport(this);

  get _connected() {
    return this.transport._connected;
  }
  get _destroyed() {
    return this.transport._destroyed;
  }

  abstract doSend(data: DataMap[]): void;

  onReceive(data: DataMap[]) {
    this.transport.onReceive(data);
  }
  callImmediate(f: () => void) {
    this.transport.callImmediate(f);
  }
  lockImmediate(source: any) {
    this.transport.lockImmediate(source);
  }
  unlockImmediate(source: any) {
    this.transport.unlockImmediate(source);
  }

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

  readonly descRequests: Map<string, DescRequest> = new Map();
  /** Maps each listener to the function scope of its DescRequest. */
  readonly descListenerPaths: Map<ClientDescListener, string> = new Map();
  readonly globalWatch: GlobalWatch;
  private _editorListeners: boolean;

  protected constructor(editorListeners: boolean) {
    super();
    this.updateServerPolicy(undefined, false);
    this._editorListeners = editorListeners;
    if (editorListeners) {
      this._sendSettingsRequest();

      // watchDesc - create global DescRequest
      this._getOrCreateDescRequest('');

      // watch #global
      this.globalWatch = new GlobalWatch(this);
      this.watch('#global', this.globalWatch);
    }
  }

  getBaseConn() {
    return this;
  }

  private readonly _policyChanges = new StreamDispatcher<EditPolicyView>();

  withPolicy(policy?: EditPolicy): ClientConn {
    return policy == null ? this : new PolicyConnection(this, policy);
  }

  getEditPolicyView() {
    return this._policyChanges.value;
  }

  editPolicyChanges() {
    return this._policyChanges;
  }

  private updateServerPolicy(policy?: EditPolicy, ready = true) {
    this._policyChanges.dispatch(new EditPolicyView(policy, ready));
  }

  checkEditRequest(data: DataMap, policy?: EditPolicy): string | null {
    return checkEditPolicy(policy, data, (path) => {
      const value = this.subscribes.get(path)?._cache?.value;
      if (value instanceof NoSerialize && value.type === 'Block') return true;
      if (this.watches.has(path)) return true;
      const dot = path.lastIndexOf('.');
      if (this.watches.get(path.slice(0, dot))?._cachedMap?.[path.slice(dot + 1)]) return true;
      return false;
    });
  }

  addSend(data: ConnectionSendingData) {
    this.transport.addSend(data);
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
      const req = this.requests.get(response.id);
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
    } else if (response.cmd === 'editPolicy') {
      this.updateServerPolicy((response.policy as EditPolicy) ?? undefined);
    }
  }
  _initSimpleRequest(c: ClientCallbacks): {promise: Promise<any>; callbacks: ClientCallbacks} {
    let callbacks: ClientCallbacks = c;
    let promise: Promise<any>;
    if (!c) {
      promise = new Promise((resolve, reject) => {
        callbacks = {
          onDone: resolve,
          onUpdate: resolve,
          onError: reject,
        };
      });
    }

    return {promise, callbacks};
  }
  simpleRequest(data: DataMap): Promise<any>;
  simpleRequest(data: DataMap, c: ClientCallbacks, policy?: EditPolicy): Promise<any> | string;
  simpleRequest(data: DataMap, c?: ClientCallbacks, policy?: EditPolicy): Promise<any> | string {
    const error = this.checkEditRequest(data, policy);
    if (error) return this.rejectRequest(data, c, error);
    return this.sendRequest(data, c);
  }

  protected sendRequest(data: DataMap, c?: ClientCallbacks): Promise<any> | string {
    const {promise, callbacks} = this._initSimpleRequest(c);
    const id = this.uid.next();
    data.id = id;
    const req = new ClientRequest(data, callbacks);
    this.requests.set(id, req);
    this.addSend(req);
    return promise ?? id;
  }

  private rejectRequest(data: DataMap, callbacks: ClientCallbacks, error: string): Promise<any> | string {
    if (!callbacks) return Promise.reject(error);
    const id = this.uid.next();
    callbacks.onError?.(error, {...data, id});
    return id;
  }

  sendValueRequest(
    data: DataMap,
    important: boolean | ClientCallbacks = false,
    policy?: EditPolicy
  ): Promise<any> | string {
    // Check before merging or cancelling: rejection in one view must not change another view's queued edit.
    const error = this.checkEditRequest(data, policy);
    if (error)
      return important ? this.rejectRequest(data, typeof important === 'object' ? important : undefined, error) : '';
    const path = data.path as string;
    let req = this.setRequests.get(path);
    if (important) {
      req?.cancel();
      return this.sendRequest(data, typeof important === 'object' ? important : undefined);
    }
    if (!req) {
      req = new SetRequest(path, this.uid.next(), this);
      this.setRequests.set(path, req);
    }
    req.update(data);
    this.addSend(req);
    return '';
  }

  _sendSettingsRequest() {
    this.simpleRequest(
      {cmd: 'getSettings', path: ''},
      {
        onUpdate(response: DataMap) {
          updateGlobalSettings(new DataWrapper(response));
        },
      }
    );
  }
  _sendLargeData(data: DataMap, c: ClientCallbacks = null): Promise<any> | null {
    return null;
  }

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue: boolean = false) {
    if (this.subscribes.has(path)) {
      const sub = this.subscribes.get(path);
      if (fullValue) {
        sub.addFull(callbacks);
      } else {
        sub.add(callbacks);
      }
    } else {
      const id = this.uid.next();
      const data = {cmd: 'subscribe', path, id, fullValue};
      const req = new SubscribeRequest(data, path, this);
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
    const req = this.subscribes.get(path);
    if (req) {
      req.remove(callbacks);
      if (req.isEmpty()) {
        const id = String(req._data.id);
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
      const id = this.uid.next();
      const data = {cmd: 'watch', path, id};
      const req = new WatchRequest(data, callbacks);
      this.requests.set(id, req);
      this.watches.set(path, req);
      this.addSend(req);
    }
  }

  unwatch(path: string, callbacks: ClientCallbacks): void {
    const req = this.watches.get(path);
    if (req) {
      req.remove(callbacks);
      if (req.isEmpty()) {
        const id = String(req._data.id);
        req._data = {cmd: 'close', id};
        this.addSend(req);
        this.watches.delete(path);
        this.requests.delete(id);
      }
    }
  }

  cancel(id: string) {
    const req = this.requests.get(id);
    if (req instanceof ClientRequest) {
      req.cancel();
      this.requests.delete(id);
    }
  }

  /** Get or create a DescRequest for the given function scope. */
  private _getOrCreateDescRequest(funcLib: string): DescRequest {
    let descReq = this.descRequests.get(funcLib);
    if (!descReq) {
      const id = this.uid.next();
      const data = {cmd: 'watchDesc', path: funcLib || '', id};
      descReq = new DescRequest(data, !!funcLib);
      this.descRequests.set(funcLib, descReq);
      this.requests.set(id, descReq);
      this.addSend(descReq);
    }
    return descReq;
  }

  watchDesc(funcId: string, funcLib?: string, listener?: ClientDescListener): FunctionDesc {
    const resolvedScopePath = funcLib || '';
    if (listener) {
      const descReq = this._getOrCreateDescRequest(resolvedScopePath);
      descReq.listeners.set(listener, funcId);
      this.descListenerPaths.set(listener, resolvedScopePath);
      if (funcId === '*') {
        // listen to all descs
        for (const [id, desc] of descReq.cache) {
          listener(desc, id);
        }
      } else if (descReq.cache.has(funcId)) {
        listener(descReq.cache.get(funcId), funcId);
      } else {
        listener(null, funcId);
      }
    } else {
      // cache lookup uses the resolved function scope's DescRequest
      const req = this.descRequests.get(resolvedScopePath);
      return req?.cache.get(funcId);
    }
    return null;
  }

  unwatchDesc(listener: ClientDescListener) {
    const path = this.descListenerPaths.get(listener);
    if (path == null) {
      return;
    }
    this.descListenerPaths.delete(listener);
    const descReq = this.descRequests.get(path);
    if (!descReq) {
      return;
    }
    descReq.listeners.delete(listener);
    // If no listeners remain and it's not the permanent global DescRequest, close it
    if (descReq.listeners.size === 0 && !(path === '' && this._editorListeners)) {
      const id = String(descReq._data.id);
      descReq._data = {cmd: 'close', id};
      this.addSend(descReq);
      this.descRequests.delete(path);
      this.requests.delete(id);
    }
  }

  getCategory(category: string): FunctionDesc {
    return this.descRequests.get('')?.categories.get(category);
  }

  // find the common base Desc
  _getCachedDesc(id: string, funcLib?: string): FunctionDesc {
    return this.descRequests.get(funcLib || '')?.cache.get(id) || this.descRequests.get('')?.cache.get(id);
  }

  getCommonBaseFunc(set: Set<FunctionDesc>, funcLib?: string): FunctionDesc {
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
            desc = this._getCachedDesc(desc.base, funcLib);
          } else {
            break;
          }
        } while (desc);
      } else {
        // check if
        do {
          const match = collected.indexOf(desc);
          if (match >= 0) {
            if (match > commonMatch) {
              commonMatch = match;
            }
            break;
          }
          if (desc.base) {
            desc = this._getCachedDesc(desc.base, funcLib);
          } else {
            // no match and no base to check
            return null;
          }
        } while (desc);
      }
    }
    return collected[commonMatch];
  }

  getOptionalProps(desc: FunctionDesc, funcLib?: string): {[key: string]: PropDesc} {
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
        desc = this._getCachedDesc(desc.base, funcLib);
      } else {
        break;
      }
    } while (desc);
    return result;
  }

  findGlobalBlocks(tags: string[]): string[] {
    const result: string[] = [];
    if (this.globalWatch && Array.isArray(tags)) {
      for (const [key, listener] of this.globalWatch.isListeners) {
        const funcDesc = this.watchDesc(listener.value);
        if (funcDesc && funcDesc.tags) {
          for (const tag of tags) {
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
    this.transport.onConnect();
    // TODO: add some delay to make sure the connection is correct
    this._reconnectInterval = 1;
  }

  onDisconnect() {
    this.transport.onDisconnect();
    this.updateServerPolicy(undefined, false);
    // remove requests from the map
    // or notify the disconnection
    for (const [key, req] of this.requests) {
      if (req instanceof MergedClientRequest) {
        req.onDisconnect();
        this.addSend(req);
      } else if (req instanceof DescRequest) {
        req.onDisconnect();
        this.addSend(req);
      } else {
        req.onError('disconnected');
        this.requests.delete(key);
        this.transport._sending.delete(req as any);
      }
    }
    this._sendSettingsRequest();
    if (!this._destroyed) {
      // reconnect after N seconds, N = 1,2,3,4 ... 60
      this._reconnectTimeout = setTimeout(() => this.reconnect(), this._reconnectInterval * 1000);
      if (this._reconnectInterval < 60) {
        this._reconnectInterval++;
      }
    }
  }

  destroy() {
    for (const [key, req] of this.requests) {
      req.onError('disconnected');
    }
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
    }
    this.transport.destroy();
  }
}

/** The physical transport is shared by every policy view of a client connection. */
class ClientTransport extends Connection {
  constructor(private readonly client: ClientConnection) {
    super();
  }
  doSend(data: DataMap[]) {
    this.client.doSend(data);
  }
  onData(data: DataMap) {
    this.client.onData(data);
  }
}
