import {Connection, ConnectionSendingData, ConnectionSend, type ConnectionOptions} from './Connection.ts';
import {
  BlockBindingSource,
  BlockIO,
  BlockProperty,
  BlockPropertyEvent,
  BlockPropertySubscriber,
  EmbeddedBlockSlot,
} from '../block/BlockProperty.ts';
import {DataMap, isPrimitiveType, isStringArray, measureObjSize} from '../util/DataTypes.ts';
import {truncateData} from '../util/DataTruncate.ts';
import {Block, BlockChildWatch} from '../block/Block.ts';
import {InputsBlock} from '../block/FlowIO.ts';
import {Flow, Root} from '../block/Flow.ts';
import {flowRefFromPath} from '../block/FlowRuntime.ts';
import {FlowWithStatic, StaticConfig} from '../block/StaticBlock.ts';
import {PropDispatcher, PropListener} from '../block/Dispatcher.ts';
import {DescListener, FunctionModule, globalFunctions} from '../block/FunctionModule.ts';
import {
  buildPropDescCache,
  findPropDesc,
  FunctionDesc,
  getInlineProp,
  PropDesc,
  PropGroupDesc,
} from '../block/Descriptor.ts';
import {propRelative} from '../util/PropPath.ts';
import {
  insertGroupProperty,
  moveGroupProperty,
  removeGroupProperty,
  setGroupLength,
} from '../property-api/GroupProperty.ts';
import {findPropertyForNewBlock, renameProperty} from '../property-api/PropertyName.ts';
import {hideProperties, moveShownProperty, showProperties} from '../property-api/PropertyShowHide.ts';
import {
  addCustomProperty,
  copyCustomPropertyDescriptor,
  moveCustomProperty,
  removeCustomProperty,
} from '../property-api/CustomProperty.ts';
import {FlowEditor} from '../worker/FlowEditor.ts';
import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../property-api/OptionalProperty.ts';
import {WorkerFunctionGen} from '../worker/WorkerFunctionGen.ts';
import {isBindable, validateNodePath} from '../util/Path.ts';
import {ClientCallbacks} from './ClientRequests.ts';
import {
  copyProperties,
  createStaticBlock,
  deleteProperties,
  moveBlocks,
  pasteProperties,
} from '../property-api/CopyPaste.ts';
import {deleteBlock} from '../property-api/DeleteBlock.ts';
import {BlockInputsConfig, BlockOutputsConfig} from '../block/FlowConfigs.ts';
import {WorkerFlow} from '../worker/WorkerFlow.ts';
import {Query, queryBlock} from './Query.ts';
import {getGlobalSettingsData} from '../util/Settings.ts';
import {DoneEvent} from '../block/Event.ts';
import {Library} from '../block/Library.ts';
import {libraryFromPath, validateLibrary} from '../util/LibraryMetadata.ts';
import {readValuePage, type ValuePageOptions, type ValueReadOptions} from './ValuePage.ts';

import {
  MAX_LIVE_TARGETS,
  type LiveEvent,
  type LiveExplorer,
  type LiveExplorerSource,
  type LivePageRequest,
  type LiveQueryEvent,
  type LiveSubscription,
  type LiveUpdate,
} from '../functions/live/LiveSource.ts';

export class ServerRequest extends ConnectionSendingData {
  id: string;
  connection: ServerConnection;

  close(): void {
    // to be overridden
  }
}

class ServerLiveWatch extends ServerRequest implements PropListener {
  private rows = new Map<string, {subscription?: LiveSubscription}>();
  private pendingRows = new Map<string, {value?: LiveEvent; status?: LiveEvent}>();
  private pendingFeed: LiveUpdate[] = [];
  private terminalFeed?: LiveEvent;
  private pendingQuery?: LiveQueryEvent;
  private feed?: LiveSubscription;
  private dropped = 0;
  private closed = false;

  constructor(
    connection: ServerConnection,
    id: string,
    readonly path: string,
    private property: BlockProperty,
    private explorer: LiveExplorer
  ) {
    super();
    this.connection = connection;
    this.id = id;
    property.listen(this);
  }

  onSourceChange(source: PropDispatcher) {
    if (source !== this.property) this.onChange(undefined);
  }

  onChange(value: unknown) {
    if (this.closed || (value as LiveExplorerSource)?.liveExplorer === this.explorer) return;
    this.connection.close(this.id);
    this.connection.sendError(this.id, 'Live source changed');
  }

  capture(query: DataMap, follow: boolean) {
    this.feed = this.explorer.capture(query, (event) => this.push(event), follow);
  }

  watchQuery(query: DataMap, limit: number) {
    this.feed = this.explorer.watchQuery(query, limit, (event) => {
      if (this.closed) return;
      if (event.type === 'results') {
        this.pendingQuery = {...event, rows: event.rows.slice(0, limit)};
        this.connection.addSend(this);
      } else {
        this.push(event);
      }
    });
  }

  canSetTargets() {
    return !this.feed && Boolean(this.explorer.watchRow);
  }

  setTargets(targets: string[]) {
    const desired = new Set(targets);
    for (const [target, row] of this.rows) {
      if (!desired.has(target)) {
        this.rows.delete(target);
        this.pendingRows.delete(target);
        row.subscription?.close();
      }
    }
    for (const target of desired) {
      if (this.rows.has(target)) continue;
      const row: {subscription?: LiveSubscription} = {};
      this.rows.set(target, row);
      try {
        row.subscription = this.explorer.watchRow(target, (event) => {
          if (this.rows.get(target) === row) this.push(event, target);
        });
      } catch (error) {
        this.push({type: 'status', status: 'error', message: String(error)}, target);
      }
    }
  }

  private push(event: LiveEvent, target?: string) {
    if (this.closed) return;
    if ('value' in event) {
      const [value] = truncateData(event.value, this.connection.maxValueSize);
      if (value !== event.value) event = {...event, value};
    }
    if (target === undefined) {
      if (event.type === 'status' && event.status === 'closed') this.terminalFeed = event;
      else if (this.pendingFeed.length < 64) this.pendingFeed.push({event});
      else ++this.dropped;
    } else {
      let pending = this.pendingRows.get(target);
      if (!pending) {
        pending = {};
        this.pendingRows.set(target, pending);
      }
      if (event.type === 'status' || event.type === 'gap') pending.status = event;
      else pending.value = event;
    }
    this.connection.addSend(this);
  }

  getSendingData() {
    const updates: LiveUpdate[] = [];
    let size = 0;
    const limit = this.connection.maxMessageSize;
    if (this.dropped) {
      updates.push({event: {type: 'gap', dropped: this.dropped}});
      this.dropped = 0;
      size += 32;
    }
    for (const [target, {value, status}] of this.pendingRows) {
      this.pendingRows.delete(target);
      for (const event of [status, value]) {
        if (event) {
          const update = {target, event};
          updates.push(update);
          size += measureObjSize(update);
        }
      }
      if (size >= limit) break;
    }
    let sent = 0;
    if (size < limit) {
      for (const update of this.pendingFeed) {
        updates.push(update);
        ++sent;
        size += measureObjSize(update);
        if (size >= limit) break;
      }
    }
    if (sent) this.pendingFeed.splice(0, sent);
    if (this.pendingQuery && size < limit) {
      updates.push({event: this.pendingQuery});
      size += measureObjSize(this.pendingQuery);
      this.pendingQuery = undefined;
    }
    if (this.terminalFeed && !this.pendingFeed.length && size < limit) {
      updates.push({event: this.terminalFeed});
      size += measureObjSize(this.terminalFeed);
      this.terminalFeed = undefined;
    }
    if (this.pendingRows.size || this.pendingFeed.length || this.pendingQuery || this.terminalFeed)
      this.connection.addSend(this);
    return {data: updates.length ? {cmd: 'update', id: this.id, updates} : null, size};
  }

  close() {
    this.closed = true;
    this.property.unlisten(this);
    for (const row of this.rows.values()) row.subscription?.close();
    this.rows.clear();
    this.pendingRows.clear();
    this.pendingFeed.length = 0;
    this.pendingQuery = undefined;
    this.terminalFeed = undefined;
    this.feed?.close();
  }
}

function validLiveTargets(targets: unknown): targets is string[] {
  return (
    Array.isArray(targets) &&
    targets.length <= MAX_LIVE_TARGETS &&
    targets.every((target) => typeof target === 'string' && target.length <= 4096)
  );
}

function validLivePage({limit, cursor}: LivePageRequest) {
  return (
    Number.isSafeInteger(limit) &&
    limit > 0 &&
    limit <= 256 &&
    (cursor === undefined || (typeof cursor === 'string' && cursor.length <= 4096))
  );
}

function getLiveExplorer(root: Root, path: string) {
  const block = root.queryValue(path);
  const property = block instanceof Block ? block.getProperty('#output', false) : undefined;
  const explorer = (property?.getValue() as LiveExplorerSource)?.liveExplorer;
  return {property, explorer};
}

class ServerSubscribe extends ServerRequest implements BlockPropertySubscriber, PropListener<any> {
  property: BlockProperty;
  source: BlockBindingSource;

  // make sure the initial value is treat as a change for new subscription
  valueChanged = true;
  hasListener?: boolean = undefined;
  events: BlockPropertyEvent[] = [];

  constructor(conn: ServerConnection, id: string, prop: BlockProperty) {
    super();
    this.id = id;
    this.connection = conn;
    this.property = prop;
    prop.subscribe(this);
    if (prop._bindingPath) {
      // add event for current bindingPath
      this.events.push({bind: prop._bindingPath});
    }
  }

  onSourceChange(prop: PropDispatcher<any>) {
    if (prop !== this.property) {
      this.connection.close(this.id);
      this.connection.sendError(this.id, 'source changed');
    }
  }

  onChange(val: any) {
    this.valueChanged = true;
    this.connection.addSend(this);
  }

  onPropertyEvent(change: BlockPropertyEvent): void {
    this.events.push(change);
    this.connection.addSend(this);
  }

  getSendingData(): {data: DataMap; size: number} {
    if (!this.property) {
      return {data: null, size: 0};
    }
    let updateNeeded = false;
    const data: DataMap = {id: this.id, cmd: 'update'};
    let total = 0;
    if (this.valueChanged) {
      let value = this.property.getValue();
      if (
        !this.property._bindingSource &&
        this.property._saved !== undefined &&
        !Object.is(this.property._saved, value)
      ) {
        data.temp = true;
        total += 8;
      }
      if (value === undefined) {
        data.undefined = true;
        total += 13;
      } else {
        let size: number;
        [value, size] = truncateData(value, this.connection.maxValueSize);
        total += size;
        data.value = value;
      }
      this.valueChanged = false;
      updateNeeded = true;
    }
    const sendEvent: BlockPropertyEvent[] = [];
    let bindingChanged = false;
    let listenerChanged = false;
    if (this.events.length) {
      for (const e of this.events) {
        if ('bind' in e) {
          // extract and merge binding event
          bindingChanged = true;
          continue;
        }
        if ('listener' in e) {
          listenerChanged = true;
          continue;
        }
        if (e.error) {
          total += e.error.length;
          sendEvent.push(e);
        }
      }
      if (sendEvent.length) {
        data.events = sendEvent;
        updateNeeded = true;
      }
      this.events = [];
    }
    if (bindingChanged) {
      data.bindingPath = this.property._bindingPath ?? null;
      updateNeeded = true;
    }
    if (listenerChanged) {
      let hasListener = false;
      if (this.property._listeners) {
        for (const listener of this.property._listeners) {
          if (listener instanceof PropDispatcher) {
            if (listener instanceof BlockProperty && listener._block instanceof InputsBlock && !listener._bindingPath) {
              // InputsBlock is a special case, don't show hasListener dot
              continue;
            }
            hasListener = true;
            break;
          }
        }
      }
      if (hasListener !== this.hasListener) {
        this.hasListener = hasListener;
        data.hasListener = hasListener;
        updateNeeded = true;
      }
    }
    if (updateNeeded) {
      return {data, size: total};
    }
    return {data: null, size: 0};
  }

  close() {
    this.source.unlisten(this);
    if (this.property._block && !this.property._block._destroyed) {
      this.property.unsubscribe(this);
    }
    this.property = null;
  }
}

class ServerWatch extends ServerRequest implements BlockChildWatch, PropListener<any> {
  block: Block;
  property: BlockProperty;
  source: PropDispatcher<any>;

  watchHistory = true;

  constructor(conn: ServerConnection, id: string, block: Block, prop: BlockProperty) {
    super();
    this.id = id;
    this.connection = conn;
    this.block = block;
    this.property = prop;
    block.watch(this);
    this.connection.addSend(this);
  }

  // Listener.onSourceChange
  onSourceChange(prop: PropDispatcher<any>): void {
    if (prop !== this.property) {
      this.connection.close(this.id);
      this.connection.sendError(this.id, 'source changed');
    }
  }

  // Listener.onChange
  onChange(val: any): void {
    if (val !== this.block) {
      this.connection.close(this.id);
      this.connection.sendError(this.id, 'block changed');
    }
  }

  _pendingChanges: {[key: string]: string} = null;
  _cached: Set<string> = new Set();

  // BlockChildWatch
  onChildChange(property: BlockProperty, saved?: boolean) {
    if (this._pendingChanges && property instanceof BlockIO) {
      const val = property._saved;
      if (saved && val instanceof Block) {
        this._cached.add(property._name);
        this._pendingChanges[property._name] = val._blockId;
        this.connection.addSend(this);
      } else {
        if (this._cached.has(property._name)) {
          this._cached.delete(property._name);
          this._pendingChanges[property._name] = null;
          this.connection.addSend(this);
        }
      }
    }
  }

  getSendingData(): {data: DataMap; size: number} {
    let changes: {[key: string]: string};
    if (this._pendingChanges) {
      changes = this._pendingChanges;
    } else {
      changes = {};
      this.block.forEach((field: string, value: unknown, prop: BlockIO) => {
        if (prop._saved instanceof Block) {
          changes[field] = (value as Block)._blockId;
          this._cached.add(field);
        }
      });
    }
    this._pendingChanges = {};
    let size = 0;
    for (const name in changes) {
      size += name.length;
      if (changes[name]) {
        size += changes[name].length;
      } else {
        size += 4;
      }
    }
    return {data: {id: this.id, cmd: 'update', changes}, size};
  }

  close() {
    this.source.unlisten(this);
    this.block.unwatch(this);
  }
}

class ServerDescWatcher extends ServerRequest implements DescListener {
  pendingIds: Set<string>;
  private _funcModule: FunctionModule;

  constructor(conn: ServerConnection, id: string, funcModule?: string) {
    super();
    this.id = id;
    this.connection = conn;
    if (funcModule) {
      const property = conn.root.queryProperty(funcModule);
      if (property?._value instanceof Flow) {
        this._funcModule = property._value.getFuncModule();
      }
    }
    if (this._funcModule) {
      this.pendingIds = new Set(this._funcModule.getAllFunctionIds());
      this._funcModule.listenDesc(this);
    } else {
      this.pendingIds = new Set(Library.getAllFunctionIds(conn.root));
      Library.listenDesc(this, conn.root);
    }
    this.connection.addSend(this);
  }

  onDescChange(id: string, desc: FunctionDesc): void {
    this.pendingIds.add(id);
    this.connection.addSend(this);
  }

  _getDescToSend(id: string): [FunctionDesc, number] {
    if (this._funcModule) {
      return this._funcModule.getDescToSend(id);
    }
    return Library.getDescToSend(id, this.connection.root);
  }

  getSendingData(): {data: DataMap; size: number} {
    const changes = [];
    let totalSize = 0;
    for (const id of this.pendingIds) {
      const [desc, size] = this._getDescToSend(id);
      if (desc) {
        changes.push(desc);
        totalSize += size;
      } else {
        changes.push({id, removed: true});
        totalSize += id.length + 10;
      }
      this.pendingIds.delete(id);
      if (totalSize >= this.connection.maxMessageSize) {
        break;
      }
    }
    if (this.pendingIds.size !== 0) {
      this.connection.addSend(this);
    }
    return {data: {id: this.id, cmd: 'update', changes}, size: totalSize};
  }

  close() {
    if (this._funcModule) {
      this._funcModule.unlistenDesc(this);
    } else {
      Library.unlistenDesc(this, this.connection.root);
    }
  }
}

function getTrackedFlow(block: Block, path: string, root: Root): Flow {
  let flow: Flow;
  const staticPath = '.#static';
  const staticIndex = path.indexOf(staticPath);
  // Only treat `.#static` specially when it appears as a complete path segment,
  // so similar substrings inside other property names are ignored.
  if (
    staticIndex >= 0 &&
    (path.length === staticIndex + staticPath.length || path[staticIndex + staticPath.length] === '.')
  ) {
    const owner = root.queryProperty(path.substring(0, staticIndex))?._value;
    flow = owner instanceof FlowWithStatic ? owner : block._flow;
  } else if (path.endsWith('.@b-xyw')) {
    // Synced block-position attributes can be stored on a child while the edit
    // belongs to the parent canvas flow's undo/history boundary.
    flow = block._parent._flow;
  } else {
    flow = block._flow;
  }
  return flow;
}

function trackChange(property: BlockProperty, path: string, root: Root) {
  getTrackedFlow(property._block, path, root).trackChange();
}

export interface ServerConnectionOptions extends ConnectionOptions {
  readonly?: boolean;
}

const readCommands = new Set([
  'get',
  'list',
  'query',
  'subscribe',
  'watch',
  'watchDesc',
  'getLiveCapabilities',
  'listLiveChildren',
  'searchLive',
  'watchLive',
  'setLiveTargets',
  'getSettings',
  'getFlowState',
  'getAutoLoadFlow',
  'listMainFlows',
  'listLoadedFlows',
  'getLibraryGraph',
  'getLibraryMetadata',
  'close',
]);

const runtimeCommands = new Set([
  'loadFlow',
  'unloadFlow',
  'enableFlow',
  'disableFlow',
  'enableLibrary',
  'unloadLibrary',
  'retainLibraries',
  'callFunction',
]);

class ServerConnectionCore extends Connection {
  requests: {[key: string]: ServerRequest} = {};
  readonly readonly: boolean;

  constructor(
    public root: Root,
    options?: ServerConnectionOptions
  ) {
    super(options);
    this.readonly = options?.readonly === true;
  }

  protected canWriteLibraryMetadata(path: string) {
    const storage = this.root._storage;
    return Boolean(
      !this.readonly &&
      storage?.getLibraryMetadata &&
      storage.saveLibraryMetadata &&
      (storage.isPersistent ? storage.isPersistent(libraryFromPath(path)) : storage.persistent !== false) &&
      storage.canWriteFlow?.(path) !== false
    );
  }

  /** Shared by framed transports and REST. Kept off the wire-command prototype. */
  executeRequest(request: DataMap): string | DataMap | ServerRequest | Promise<string | DataMap | ServerRequest> {
    const cmd = request.cmd as string;
    if (typeof request.path !== 'string') return 'invalid path';
    if (!Object.hasOwn(ServerConnection.prototype, cmd)) return 'invalid command';
    const func: Function = (this as any)[cmd];
    if (typeof func !== 'function' || func.length !== 1 || cmd.startsWith('on')) return 'invalid command';
    // Function commands resolve their readonly mode when they resolve the target block.
    if (cmd === 'executeCommand') return func.call(this, request);
    const canWrite = this.root._storage?.canWriteFlow?.bind(this.root._storage);
    const read = (this.readonly || canWrite) && (readCommands.has(cmd) || (cmd === 'copy' && !request.cut));
    if (this.readonly && !read) return 'readonly';
    if (canWrite && !read && !runtimeCommands.has(cmd)) {
      const path = cmd === 'deleteFunction' ? (request.funcModule ?? request.funcId) : request.path;
      if (typeof path !== 'string') return 'invalid path';
      if (!canWrite(path) || (typeof request.to === 'string' && !canWrite(request.to))) return 'Storage is read-only';
      if (cmd === 'editWorker' && !request.fromField) {
        const source = request.funcModule ?? request.fromFunction;
        if (typeof source === 'string' && !canWrite(source)) return 'Storage is read-only';
      }
      const [owner, name] = this.root.queryBlockField(path);
      if (owner && owner !== this.root && !canWrite(`${owner.getFullPath()}.${name}`)) return 'Storage is read-only';
    }
    return func.call(this, request);
  }

  addRequest(id: string, req: ServerRequest) {
    this.close(id);
    this.requests[id] = req;
  }

  private sendResult(id: string, result: string | DataMap | ServerRequest) {
    if (this._destroyed) return;
    if (result instanceof ServerRequest) {
      this.addRequest(id, result);
    } else if (typeof result === 'string') {
      this.sendError(id, result);
    } else if (result) {
      this.sendFinal(id, result);
    } else {
      this.sendDone(id);
    }
  }

  onData(request: DataMap) {
    if (typeof request.cmd === 'string' && typeof request.id === 'string') {
      if (request.cmd === 'close') {
        this.close(request.id);
        return;
      }
      if (typeof request.path === 'string') {
        try {
          const result = this.executeRequest(request);
          if (result instanceof Promise) {
            result.then(
              (data) => this.sendResult(request.id as string, data),
              (error) => {
                if (!this._destroyed)
                  this.sendError(
                    request.id as string,
                    String(error),
                    request.cmd === 'executeCommand' ? error : undefined
                  );
              }
            );
          } else {
            this.sendResult(request.id, result);
          }
        } catch (error) {
          this.sendError(request.id, String(error), request.cmd === 'executeCommand' ? error : undefined);
        }
      } else {
        this.sendError(request.id, 'invalid path');
      }
    }
  }

  sendError(id: string, msg: string, error?: unknown) {
    this.addSend(new ConnectionSend({cmd: 'error', id, msg, ...(error instanceof Error ? {error} : {})}));
  }

  sendDone(id: string) {
    this.addSend(new ConnectionSend({cmd: 'done', id}));
  }

  sendFinal(id: string, data: DataMap) {
    this.addSend(new ConnectionSend({...data, cmd: 'final', id}));
  }

  close(id: string) {
    if (Object.hasOwn(this.requests, id)) {
      this._sending.delete(this.requests[id]);
      this.requests[id].close();
      delete this.requests[id];
    }
  }

  destroy() {
    for (const key in this.requests) {
      this.requests[key].close();
    }
    this.requests = null;
    super.destroy();
  }
}

export class ServerConnection extends ServerConnectionCore {
  /**
   * Gets the global settings data.
   */
  getSettings({id}: {id: string}) {
    return getGlobalSettingsData();
  }

  /**
   * Sets the value of a property at the given path.
   */
  set({path, value, unbound}: {path: string; value: any; unbound?: boolean}): string | Promise<string> {
    const property = this.root.queryProperty(path, value !== undefined);
    if (property) {
      if (unbound === true) {
        if (property._bindingPath != null) return 'Property is bound';
        if (property.getValue() instanceof Block || property._saved instanceof Block)
          return 'Property contains a block';
      }
      if (property._value instanceof Flow) {
        const deleted = this.root.deleteFlow(path);
        if (deleted instanceof Promise) {
          return deleted.then((): string => {
            property.setValue(value);
            trackChange(property, path, this.root);
            return null;
          });
        }
      }
      property.setValue(value);
      trackChange(property, path, this.root);
      return null;
    } else if (value !== undefined) {
      return 'invalid path';
    }
  }

  /** Deletes a block through the editor helper, including its parent's #order entry. */
  deleteBlock({path}: {path: string}): string | Promise<string> {
    const property = this.root.queryProperty(path, false);
    if (!property) return 'invalid path';
    if (!(property._value instanceof Block)) return 'invalid block';
    const remove = (): string => {
      deleteBlock(property._block, property._name);
      trackChange(property, path, this.root);
      return null;
    };
    if (property._value instanceof Flow) {
      const deleted = this.root.deleteFlow(path);
      if (deleted instanceof Promise) return deleted.then(remove);
    }
    return remove();
  }

  /**
   * Retrieves the current value of the property.
   */
  get({path, select, page}: {path: string; page?: ValuePageOptions} & ValueReadOptions): DataMap | string {
    const property = this.root.queryProperty(path);
    if (property === undefined) return 'invalid path';
    let value = property?._value;
    if (select !== undefined) {
      if (!Array.isArray(select) || select.some((key) => typeof key !== 'string' && !Number.isSafeInteger(key)))
        return 'invalid value selection';
      for (const key of select) {
        if (
          !value ||
          typeof value !== 'object' ||
          (!Array.isArray(value) &&
            Object.getPrototypeOf(value) !== Object.prototype &&
            Object.getPrototypeOf(value) !== null) ||
          !Object.hasOwn(value, key)
        )
          return 'invalid value selection';
        value = Reflect.get(value, key);
      }
    }
    if (page !== undefined) return page && typeof page === 'object' ? readValuePage(value, page) : 'invalid page range';
    return property ? {value} : {};
  }

  /**
   * Queries specific data from a block at the given path based on the queried fields.
   */
  query({path, query}: {path: string; query: Query}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      return {value: queryBlock(property._value, query)};
    } else {
      return 'invalid path';
    }
  }

  /**
   * Updates the value of a property at the given path without replacing the entire property.
   * Calls `property.updateValue(value)`, which is useful for partial object updates.
   */
  update({path, value}: {path: string; value: any}): string {
    const property = this.root.queryProperty(path, true);
    if (property) {
      property.updateValue(value);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Restores a property to its internally saved state (`_saved`).
   * This is used when the current working value diverges from the saved value.
   */
  restoreSaved({path}: {path: string}): string {
    const property = this.root.queryProperty(path, true);
    if (property) {
      if (!Object.is(property._saved, property._value) && !property._bindingSource) {
        property.updateValue(property._saved);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Creates a data binding from a property to a source path.
   */
  bind({path, from, absolute, unbound}: {path: string; from: string; absolute: boolean; unbound?: boolean}): string {
    const property = this.root.queryProperty(path, true);
    if (property) {
      if (
        unbound === true &&
        (property._bindingPath != null || property._value instanceof Block || property._saved instanceof Block)
      ) {
        return 'Property is bound or contains a block';
      }
      if (absolute) {
        // from is absolute path, need to find the relative binding path
        if (from == null) {
          // remove binding but keep current primitive value
          const val = property._value;
          if (isPrimitiveType(val)) {
            property.setValue(val);
          } else {
            property.setValue(undefined);
          }
        } else {
          // `..` carries a suffix after the selected property, used by the editor
          // when binding to a nested object member inside the selected source.
          const fromParts = from.split('..');
          const fromMain = fromParts[0];
          const bindable = isBindable(path, fromMain);
          if (!bindable) {
            return 'invalid binding path';
          }
          const fromProp = this.root.queryProperty(fromParts[0], true);
          if (fromProp) {
            let resolvedFrom: string;
            if (fromMain.includes('.^')) {
              // binding string can just start from ^ for context binding
              resolvedFrom = fromMain.substring(fromMain.indexOf('.^') + 1);
            } else {
              const fromStaticPos = fromMain.lastIndexOf('.#static.');
              if (bindable === 'static') {
                const staticPath = fromMain.substring(0, fromStaticPos + 8); // path to #static
                const staticProp = this.root.queryProperty(staticPath);
                if (staticProp instanceof StaticConfig) {
                  const afterStatic = fromMain.substring(fromStaticPos + 9);
                  resolvedFrom = `${propRelative(property._block, staticProp)}.${afterStatic}`;
                }
              }
            }
            if (resolvedFrom == null) {
              resolvedFrom = propRelative(property._block, fromProp);
            }
            if (fromParts.length === 2) {
              resolvedFrom = `${resolvedFrom}.${fromParts[1]}`;
            }
            property.setBinding(resolvedFrom);
          } else {
            return 'invalid from path';
          }
        }
      } else {
        property.setBinding(from);
      }
      trackChange(property, path, this.root);
      return null;
    }
    return 'invalid path';
  }

  /**
   * Creates a new Flow.
   */
  async loadFlow({path}: {path: string}): Promise<null> {
    await this.root.loadFlow(flowRefFromPath(path));
    return null;
  }

  async unloadFlow({path, discardChanges}: {path: string; discardChanges?: boolean}): Promise<null> {
    await this.root.unloadFlow(flowRefFromPath(path), {discardChanges});
    return null;
  }

  async enableFlow({path, persist}: {path: string; persist?: boolean}): Promise<null> {
    await this.root.enableFlow(flowRefFromPath(path), {persist});
    return null;
  }

  async disableFlow({path, persist}: {path: string; persist?: boolean}): Promise<null> {
    await this.root.disableFlow(flowRefFromPath(path), {persist});
    return null;
  }

  getFlowState({path}: {path: string}) {
    return {state: this.root.getFlowState(flowRefFromPath(path))};
  }

  getLibraryGraph({path}: {path: string}) {
    if (path !== '') return 'invalid path';
    return {
      ...this.root.getLibraryGraph(),
      canLoad: !this.readonly && Boolean(this.root._storage),
      hasMetadata: Boolean(this.root._storage?.getLibraryMetadata),
    };
  }

  async enableLibrary({path}: {path: string}): Promise<null> {
    await this.root.enableLibrary(libraryFromPath(path));
    return null;
  }

  async unloadLibrary({path}: {path: string}): Promise<null> {
    await this.root.unloadLibrary(libraryFromPath(path));
    return null;
  }

  async retainLibraries({path, names}: {path: string; names: string[]}) {
    if (path !== '' || !isStringArray(names)) return 'invalid libraries';
    names.forEach(validateLibrary);
    await this.root.retainLibraries(names);
    return null;
  }

  async getLibraryMetadata({path}: {path: string}) {
    const name = libraryFromPath(path);
    return {
      metadata: await this.root._storage?.getLibraryMetadata?.(name),
      canWrite: this.canWriteLibraryMetadata(path),
    };
  }

  async setLibraryDependencies({path, dependencies}: {path: string; dependencies: string[]}) {
    const name = libraryFromPath(path);
    if (!isStringArray(dependencies)) return 'invalid dependencies';
    if (!this.canWriteLibraryMetadata(path)) return 'Storage is read-only';
    await this.root.setLibraryDependencies(name, dependencies);
    return null;
  }

  async getAutoLoadFlow({path}: {path: string}) {
    const ref = flowRefFromPath(path);
    if (ref.kind !== 'flow') return 'invalid flow';
    const storage = this.root._storage;
    if (!storage?.getLibraryMetadata) return {autoLoad: false, canAutoLoad: false};
    const metadata = await storage.getLibraryMetadata(ref.library);
    return {
      autoLoad: metadata.autoLoadFlows?.includes(ref.name) ?? ref.library === '#root',
      canAutoLoad: Boolean(
        storage.saveLibraryMetadata &&
        (storage.isPersistent ? storage.isPersistent(ref.library) : storage.persistent !== false) &&
        (await storage.listFlows?.(ref.library))?.includes(ref.name)
      ),
    };
  }

  async listMainFlows({path}: {path: string}) {
    if (path !== '') return 'invalid path';
    return {flows: await this.root.listMainFlows()};
  }

  listLoadedFlows({path}: {path: string}) {
    return {flows: this.root.getLoadedFlowRefs(path)};
  }

  async setAutoLoadFlow({path, enabled}: {path: string; enabled: boolean}) {
    const ref = flowRefFromPath(path);
    if (ref.kind !== 'flow' || typeof enabled !== 'boolean') return 'invalid flow';
    await this.root.setAutoLoadFlow(ref.library, ref.name, enabled);
    return null;
  }

  addFlow({path, data}: {path: string; data?: DataMap}): string | Promise<null> {
    const flow = this.root.addFlow(path, data);
    if (flow) {
      return flow.pendingCreate ? flow.pendingCreate.then((): null => null) : null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Creates a new FlowFolder to organize multiple flows.
   */
  addFlowFolder({path}: {path: string}): string | DataMap | Promise<null> {
    const folder = this.root.addFlowFolder(path);
    if (folder) {
      return folder.pendingCreate ? folder.pendingCreate.then((): null => null) : null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Creates a new child Block. The server extracts the parent block and the new block's name from `path`.
   */
  addBlock({
    path,
    data,
    findName,
    orderIndex,
  }: {
    path: string;
    data?: DataMap;
    findName?: boolean;
    orderIndex?: number;
  }): string | DataMap {
    let [parentBlock, blockName, parentProp] = this.root.queryBlockField(path);
    if (!parentBlock) {
      if (orderIndex !== undefined) return 'invalid path';
      if (!parentProp) {
        const parentPath = path.substring(0, path.lastIndexOf('.'));
        if (parentPath.endsWith('.#static')) {
          const staticOwnerPath = parentPath.substring(0, parentPath.length - 8);
          const staticOwner = this.root.queryProperty(staticOwnerPath, false)?._value;
          if (staticOwner instanceof FlowWithStatic) {
            parentProp = staticOwner.getProperty('#static', true);
          }
        }
      }
      if (parentProp?._name === '#static') {
        if (createStaticBlock(parentProp)) {
          // get the block again
          [parentBlock, blockName] = this.root.queryBlockField(path);
        }
        if (!parentBlock) {
          return 'invalid path';
        }
      } else {
        return 'invalid path';
      }
    }
    let order: string[];
    if (orderIndex !== undefined) {
      const value = parentBlock.getValue('#order') ?? [];
      if (parentBlock.getProperty('#order', false)?._bindingSource || !isStringArray(value)) return 'invalid order';
      order = value;
      if (!Number.isInteger(orderIndex) || orderIndex < 0 || orderIndex > order.length) return 'invalid index';
      const funcId = data?.['#is'];
      const desc =
        typeof funcId === 'string' ? Library.getFunctions(funcId, parentBlock._flow)?.getDesc(funcId) : undefined;
      const parentId = parentBlock._funcId;
      const childrenTags = parentId
        ? Library.getFunctions(parentId, parentBlock._flow)?.getDesc(parentId)?.childrenTags
        : undefined;
      if (!childrenTags?.some((tag) => desc?.tags?.includes(tag))) return 'incompatible children tags';
    }
    let property: BlockProperty;

    if (findName) {
      property = findPropertyForNewBlock(parentBlock, blockName);
    } else {
      property = parentBlock.getProperty(blockName);
    }

    if (property) {
      let keepSaved: any;
      let keepBinding: string;
      const funcId = data?.['#is'];
      if (typeof funcId === 'string' && funcId.startsWith('flow:')) {
        if (funcId === 'flow:inputs') {
          property = parentBlock.getProperty('#inputs');
          if (property instanceof BlockInputsConfig && property.isCleared()) {
            const inputBlock = parentBlock.createBlock('#inputs');
            if (parentBlock instanceof Flow) {
              const defaultFlow = parentBlock._parent.getDefaultWorker(null);
              const inputs = defaultFlow?.['#inputs'];
              if (Object.isExtensible(inputs)) {
                inputBlock._load({...data, ...(inputs as DataMap)});
                // Since data is already loaded, we can skip the next load.
                data = null;
                parentBlock.updateInput(parentBlock._lastInput);
              }
            }
          } else {
            return 'invalid path';
          }
        } else if (funcId === 'flow:outputs') {
          property = parentBlock.getProperty('#outputs');
          if (property instanceof BlockOutputsConfig && property.isCleared()) {
            const outputBlock = parentBlock.createBlock('#outputs');
            if (parentBlock instanceof Flow) {
              const defaultFlow = parentBlock._parent.getDefaultWorker(null);
              const inputs = defaultFlow?.['#outputs'];
              if (Object.isExtensible(inputs)) {
                outputBlock._load({...data, ...(inputs as DataMap)});
                // Since data is already loaded, we can skip the next load.
                data = null;
              }
            }
          } else {
            return 'invalid path';
          }
        } else {
          return 'invalid function';
        }
      } else if (findName) {
        // We can skip the next setion if we already adjusted the name
        parentBlock.createBlock(property._name);
      } else {
        if (property instanceof EmbeddedBlockSlot) {
          // Create an embedded Block and transfer the current property when supported.
          const baseProperty = property._block.getProperty(property._name.substring(1));
          // check the current value and binding
          if (baseProperty._saved !== undefined) {
            if (!(baseProperty._saved instanceof Block)) {
              keepSaved = baseProperty._saveValue();
            }
          } else if (baseProperty._bindingPath) {
            keepBinding = baseProperty._bindingPath;
            if (!(keepBinding.startsWith('#flow.') || keepBinding.startsWith('^'))) {
              // point the binding path to parent object
              keepBinding = `##.${keepBinding}`;
            }
          }
          property.setValue(undefined);
          property._block.createEmbeddedBlock(baseProperty._name);
        } else {
          property.setValue(undefined);
          property._block.createBlock(property._name);
        }
      }

      if (typeof funcId === 'string' && data) {
        (property._value as Block)._load(data);
        const desc = Library.getDesc(funcId, this.root);
        if (desc && desc.recipient && !Object.hasOwn(data, desc.recipient)) {
          // transfer parent property to the recipient
          if (keepSaved !== undefined) {
            (property._value as Block).getProperty(desc.recipient)._liveUpdate(keepSaved);
          } else if (keepBinding) {
            (property._value as Block).setBinding(desc.recipient, keepBinding);
          }
        }
      }
      if (order) {
        const insertion = orderIndex - order.slice(0, orderIndex).filter((name) => name === property._name).length;
        const newOrder = order.filter((name) => name !== property._name);
        newOrder.splice(insertion, 0, property._name);
        parentBlock.setValue('#order', newOrder);
      }
      trackChange(property, path, this.root);
      return {name: property._name};
    } else {
      return 'invalid path';
    }
  }

  /**
   * Lists the block children of a Block as an overview.
   */
  list({path, filter, max}: {path: string; filter: string; max: number}): string | DataMap {
    const property = this.root.queryProperty(path, true);
    if (!(max > 0 && max < 1024)) {
      max = 16;
    }
    if (property && property._value instanceof Block) {
      const block = property._value;
      let filterRegex: RegExp;
      const children: DataMap = {};
      if (filter) {
        try {
          filterRegex = new RegExp(filter);
        } catch (err) {
          return 'invalid filter';
        }
      }
      let count = 0;
      for (const [field, prop] of block._props) {
        if (prop._value instanceof Block && prop._value._prop === prop) {
          if (block === this.root && this.root._libraries[field]?._enabled === false) continue;
          if (!filterRegex || filterRegex.test(field)) {
            // filter
            if (count < max) {
              const result: any = {id: (prop._value as Block)._blockId};
              if (prop._value instanceof Flow && prop._value._applyChange) {
                result.canApply = true;
              }
              children[field] = result;
            }
            ++count;
          }
        }
      }
      return {children, count};
    } else {
      return 'invalid path';
    }
  }

  /**
   * Subscribes to value changes for a property, creating a continuous tracker.
   */
  subscribe({path, id}: {path: string; id: string}): string | ServerSubscribe {
    const property = this.root.queryProperty(path, true);
    if (property) {
      const subscriber = new ServerSubscribe(this, id, property);
      subscriber.source = this.root.createBinding(path, subscriber);
      return subscriber;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Subscribes to structural changes, child configurations, and value changes within the Block.
   */
  watch({path, id}: {path: string; id: string}): string | ServerWatch {
    const property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Block) {
      const watch = new ServerWatch(this, id, property._value, property);
      watch.source = this.root.createBinding(path, watch);
      return watch;
    } else {
      return 'invalid path';
    }
  }

  getLiveCapabilities({path}: {path: string}) {
    const {explorer} = getLiveExplorer(this.root, path);
    if (!explorer) return 'Live source is not ready';
    const capabilities = explorer.describe();
    const readonly = this.readonly || this.root._storage?.canWriteFlow?.(path) === false;
    return {capabilities: readonly ? {...capabilities, publish: undefined} : capabilities};
  }

  listLiveChildren({path, parent, limit, cursor}: {path: string; parent?: string} & LivePageRequest) {
    const {explorer} = getLiveExplorer(this.root, path);
    if (!explorer?.listChildren) return 'Tree browsing is unavailable';
    if (!validLivePage({limit, cursor}) || (parent !== undefined && typeof parent !== 'string')) return 'Invalid page';
    return explorer.listChildren(parent, {limit, cursor});
  }

  searchLive({path, query, limit, cursor}: {path: string; query: DataMap} & LivePageRequest) {
    const {explorer} = getLiveExplorer(this.root, path);
    if (!explorer?.search) return 'Search is unavailable';
    if (!validLivePage({limit, cursor}) || !query || typeof query !== 'object' || Array.isArray(query))
      return 'Invalid search';
    return explorer.search(query, {limit, cursor});
  }

  watchLive({
    path,
    id,
    targets,
    capture,
    follow,
    query,
    limit,
  }: {
    path: string;
    id: string;
    targets?: string[];
    capture?: DataMap;
    follow?: boolean;
    query?: DataMap;
    limit?: number;
  }) {
    if (!this._connected || typeof id !== 'string') return 'Live updates require a streaming connection';
    const {property, explorer} = getLiveExplorer(this.root, path);
    if (!explorer) return 'Live source is not ready';
    if (capture !== undefined) {
      if (
        !explorer.capture ||
        !capture ||
        typeof capture !== 'object' ||
        Array.isArray(capture) ||
        (follow !== undefined && typeof follow !== 'boolean') ||
        (follow && !explorer.describe().follow)
      )
        return 'Capture is unavailable';
    } else if (query !== undefined) {
      if (
        !explorer.watchQuery ||
        !query ||
        typeof query !== 'object' ||
        Array.isArray(query) ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        return 'Invalid live query';
    } else if (!explorer.watchRow || !validLiveTargets(targets)) {
      return 'Invalid live targets';
    }
    const request = new ServerLiveWatch(this, id, path, property, explorer);
    try {
      if (capture !== undefined) request.capture(capture, follow === true);
      else if (query !== undefined) request.watchQuery(query, limit);
      else request.setTargets(targets);
      return request;
    } catch (error) {
      request.close();
      throw error;
    }
  }

  setLiveTargets({path, watchId, targets}: {path: string; watchId: string; targets: string[]}) {
    const watch = this.requests[watchId];
    if (!(watch instanceof ServerLiveWatch) || watch.path !== path || !validLiveTargets(targets))
      return 'Invalid live watch';
    if (!watch.canSetTargets()) return 'Cannot change a capture';
    watch.setTargets(targets);
    return null;
  }

  /**
   * Tells the Server-side Desc Watcher to proactively start relaying function signature modifications taking place under `id`.
   */
  watchDesc({id, path: funcModule}: {id: string; path?: string}): ServerDescWatcher {
    return new ServerDescWatcher(this, id, funcModule);
  }

  /**
   * Relays a generic block-specific command (`command` parameter) payload down to the Component/Block implementation for executing bespoke logics.
   */
  executeCommand({path, command, params}: {path: string; command: string; params: DataMap}) {
    if (typeof command !== 'string') {
      return 'invalid command';
    }
    const property = this.root.queryProperty(path);
    const block = property?._value;
    if (!(block instanceof Block)) return 'invalid path';

    const storage = this.root._storage;
    let readonly = this.readonly;
    if (!readonly && storage?.canWriteFlow) {
      const ownerPath = block.getFullPath();
      readonly = !storage.canWriteFlow(path) || (ownerPath !== path && !storage.canWriteFlow(ownerPath));
    }
    if (readonly) {
      const desc = globalFunctions.getDesc(block._funcId);
      const commandDesc =
        (typeof params?.property === 'string'
          ? findPropDesc(params.property, buildPropDescCache(desc, null))?.commands?.[command]
          : undefined) ?? desc?.commands?.[command];
      if (commandDesc?.readonly !== true) return this.readonly ? 'readonly' : 'Storage is read-only';
    }

    const result = block.executeCommand(command, params, readonly);
    const finish = (value: unknown) => {
      if (value != null) return {result: value};
      if (!readonly) trackChange(property, path, this.root);
      return null;
    };
    return result instanceof Promise ? result.then(finish) : finish(result);
  }

  /**
   * Opens a FlowEditor block dynamically either from a specific user field or a base worker function.
   * The server matches the path to `#edit-...` and creates/loads the proper context so it can be viewed and edited in the UI.
   */
  editWorker({
    path,
    fromField,
    fromFunction,
    defaultData,
    funcModule,
    unbound,
  }: {
    path: string;
    fromField: string;
    fromFunction: string;
    defaultData: DataMap;
    funcModule?: string;
    unbound?: boolean;
  }) {
    const property = this.root.queryProperty(path, true);

    if (property && property._name.startsWith('#edit-')) {
      if (fromField) {
        if (unbound === true) {
          if (property._name !== `#edit-${fromField}`) return 'invalid path';
          if (property._block.getProperty(fromField, false)?._bindingPath != null) return 'Property is bound';
        }
        const moduleFlow = funcModule ? this.root.queryProperty(funcModule)?._value : undefined;
        FlowEditor.createFromField(
          property._block,
          property._name,
          fromField,
          moduleFlow instanceof Flow ? moduleFlow.getFuncModule() : undefined
        );
      } else if (fromFunction) {
        let resolvedFuncModule: FunctionModule | undefined;
        if (fromFunction.startsWith(':') && funcModule) {
          // Local flow function - resolve the funcModule from the host flow
          const flowProp = this.root.queryProperty(funcModule);
          if (flowProp?._value instanceof Flow) {
            resolvedFuncModule = flowProp._value.getFuncModule();
          }
        } else if (fromFunction.startsWith('+')) {
          resolvedFuncModule = Library.getFunctions(fromFunction, property._block._flow);
        }
        if (fromFunction.startsWith('+') || fromFunction.startsWith(':')) {
          if (defaultData && resolvedFuncModule && !resolvedFuncModule.getWorkerData(fromFunction)) {
            WorkerFunctionGen.registerType(
              defaultData,
              WorkerFunctionGen.collectDesc(fromFunction, defaultData),
              undefined,
              resolvedFuncModule
            );
          }
          FlowEditor.createFromFunction(property._block, property._name, fromFunction, defaultData, resolvedFuncModule);
        }
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Commits and applies any pending internal changes generated by `Flow` into worker function.
   */
  applyFlowChange({path, funcId, unbound}: {path: string; funcId: string; unbound?: boolean}) {
    const property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Flow) {
      if (property._value instanceof FlowEditor) {
        if (
          unbound === true &&
          property._name.startsWith('#edit-') &&
          property._block.getProperty(property._name.slice(6), false)?._bindingPath != null
        ) {
          return 'Property is bound';
        }
        const source = funcId ?? property._value._loadFrom;
        const target = source?.startsWith('+') ? source : property._value._funcModule?.flow?.getFullPath();
        if (target && this.root._storage?.canWriteFlow?.(target) === false) return 'Storage is read-only';
      }
      if (funcId && property._value instanceof FlowEditor) {
        const result = WorkerFunctionGen.applyChangeToFunc(property._value, funcId);
        if (result instanceof Promise) return result.then((): string => null);
      } else {
        const result = property._value.applyChange();
        if (result instanceof Promise) {
          return result.then((): string => {
            if (property._block._flow._history?.hasChange()) trackChange(property, path, this.root);
            return null;
          });
        }
        if (property._block._flow._history?.hasChange()) trackChange(property, path, this.root);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Deletes a registered worker function.
   */
  deleteFunction({funcId, funcModule}: {funcId: string; funcModule?: string}): string | Promise<string> {
    if (funcId.startsWith('+')) {
      const deleted = Library.delete(funcId, this.root);
      if (deleted instanceof Promise) return deleted.then((): string => null);
    } else if (funcId.startsWith(':') && funcModule) {
      const flowProp = this.root.queryProperty(funcModule);
      if (flowProp?._value instanceof Flow) {
        flowProp._value.getFuncModule().delete(funcId);
      }
    }
    return null;
  }

  /**
   * Shows properties within a Block so they're exposed in the UI.
   */
  showProps({path, props}: {path: string; props: string[]}) {
    if (!Array.isArray(props)) {
      return 'invalid properties';
    }
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      showProperties(property._value, props);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Hides properties within a Block so they're not exposed in the UI.
   */
  hideProps({path, props}: {path: string; props: string[]}) {
    if (!Array.isArray(props)) {
      return 'invalid properties';
    }
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      hideProperties(property._value, props);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  setInlineProp({path, name, enabled}: {path: string; name: string; enabled: boolean}) {
    const [owner, field] = this.root.queryBlockField(path);
    if (!owner || field !== '@b-inline') return 'invalid path';
    if (typeof name !== 'string' || !name || !validateNodePath(name) || typeof enabled !== 'boolean') {
      return 'invalid inline property';
    }
    const property = owner.getProperty(field, enabled);
    if (!property) return null;
    if (property._bindingPath != null) return 'Inline configuration is bound';
    const config = property.getValue();
    if (
      config != null &&
      (typeof config !== 'object' ||
        (Object.getPrototypeOf(config) !== Object.prototype && Object.getPrototypeOf(config) !== null))
    ) {
      return 'invalid inline configuration';
    }
    if (enabled ? getInlineProp(config, name) !== undefined : !config || !Object.hasOwn(config, name)) return null;
    const next = {...(config as DataMap)};
    if (enabled) Object.defineProperty(next, name, {value: true, enumerable: true, configurable: true});
    else delete next[name];
    property.setValue(Object.keys(next).length ? next : undefined);
    trackChange(property, path, this.root);
    return null;
  }

  /**
   * Reorders a shown property relative to another sibling property in the block's shown properties list.
   */
  moveShownProp({path, propFrom, propTo}: {path: string; propFrom: string; propTo: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveShownProperty(property._value, propFrom, propTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Modifies the array length of a Group property array dynamically.
   */
  setLen({path, group, length}: {path: string; group: string; length: number}) {
    const property = this.root.queryProperty(path, true);

    if (property && property._value instanceof Block) {
      setGroupLength(property._value, group, length);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Renames a property on a Block. Finds the property via the given path and moves it to `newName` on the parent Block.
   */
  renameProp({path, newName}: {path: string; newName: string}) {
    const property = this.root.queryProperty(path, true);

    if (property) {
      const existingProp = property._block.getProperty(newName, false);
      if (existingProp?._saved instanceof Block) {
        return 'invalid new name';
      }
      renameProperty(property._block, property._name, newName, true);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Adds a user-defined custom property schema to a Block.
   */
  addCustomProp({path, desc, group}: {path: string; desc: PropDesc | PropGroupDesc; group: string}) {
    if (!(desc instanceof Object && typeof desc.name === 'string')) {
      // TODO, full validation
      return 'invalid desc';
    }
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      addCustomProperty(property._value, desc, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Copies a connected descriptor to an existing custom property.
   */
  copyCustomPropDesc({path, name, group}: {path: string; name: string; group?: string}) {
    const property = this.root.queryProperty(path);
    if (!(property?._value instanceof Block)) return 'invalid path';
    if (typeof name !== 'string') return 'invalid property';
    if (copyCustomPropertyDescriptor(property._value, name, group)) {
      getTrackedFlow(property._value, path, this.root).trackChange();
    }
    return null;
  }

  /**
   * Removes a user-defined custom property from the Block.
   */
  removeCustomProp({path, name, group}: {path: string; name: string; group: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeCustomProperty(property._value, name, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Changes the ordering metadata of a custom property in the Block.
   */
  moveCustomProp({path, nameFrom, nameTo, group}: {path: string; nameFrom: string; nameTo: string; group: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveCustomProperty(property._value, nameFrom, nameTo, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Instantiates or enables a predefined optional property on a Block.
   */
  addOptionalProp({path, name}: {path: string; name: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      addOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Removes an optional property from the Block.
   */
  removeOptionalProp({path, name}: {path: string; name: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Changes the ordering metadata of an optional property in the Block.
   */
  moveOptionalProp({path, nameFrom, nameTo}: {path: string; nameFrom: string; nameTo: string}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveOptionalProperty(property._value, nameFrom, nameTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Inserts an unassigned new element inside a dynamic Block Group at `idx`.
   */
  insertGroupProp({path, group, idx}: {path: string; group: string; idx: number}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      insertGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Splicing removes the element spanning index `idx` from a dynamic Block Group.
   */
  removeGroupProp({path, group, idx}: {path: string; group: string; idx: number}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Transposes the element in a dynamic Block Group sequence from an origin index to a new displacement index.
   */
  moveGroupProp({path, group, oldIdx, newIdx}: {path: string; group: string; oldIdx: number; newIdx: number}) {
    const property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveGroupProperty(property._value, group, oldIdx, newIdx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Resolves the tracked parent runtime `Flow` belonging to the block at `path` and reverses the latest operational change (undo stack).
   */
  undo({path}: {path: string}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedFlow(property._value, path, this.root).undo();
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Resolves the tracked parent runtime `Flow` belonging to the block at `path` and re-applies an undone state slice (redo stack).
   */
  redo({path}: {path: string}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedFlow(property._value, path, this.root).redo();
      return null;
    } else {
      return 'invalid path';
    }
  }

  /**
   * Extracts specific serialized properties from a block entirely and returns the copied stringified structure.
   * If cut is true, the extracted properties are deleted from the block.
   */
  copy({path, props, cut}: {path: string; props: string[]; cut: boolean}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      const value = copyProperties(property._value, props);
      if (typeof value === 'string') {
        return value;
      }
      if (cut) {
        deleteProperties(property._value, props);
      }
      return {value};
    } else {
      return 'invalid path';
    }
  }

  /**
   * Loads serialized data structures onto the destination Block.
   * Evaluates logic resolution if keys/nodes collide using the literal `resolve` operation mode.
   */
  paste({path, data, resolve}: {path: string; data: DataMap; resolve?: 'overwrite' | 'rename'}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      const result = pasteProperties(property._value, data, resolve);
      if (typeof result === 'string') {
        return result;
      }
      getTrackedFlow(property._value, path, this.root).trackChange();
      return {pasted: result};
    } else {
      return 'invalid path';
    }
  }

  /** Moves child blocks between parents using the copy/paste binding rules. */
  move({path, props, to, resolve}: {path: string; props: string[]; to: string; resolve?: 'overwrite' | 'rename'}) {
    if (typeof to !== 'string') return 'invalid path';
    const source = this.root.queryProperty(path)?._value;
    const target = this.root.queryProperty(to)?._value;
    if (!(source instanceof Block) || !(target instanceof Block)) return 'invalid path';
    const result = moveBlocks(source, target, props, resolve);
    if (typeof result === 'string') return result;
    getTrackedFlow(source, path, this.root).trackChange();
    getTrackedFlow(target, to, this.root).trackChange();
    return {moved: result};
  }

  /** Moves #order children, keeping their source order and renaming destination conflicts. */
  moveOrdered({path, props, to, index}: {path: string; props: string[]; to: string; index?: number}) {
    if (typeof to !== 'string') return 'invalid path';
    const source = this.root.queryProperty(path)?._value;
    const target = this.root.queryProperty(to)?._value;
    if (!(source instanceof Block) || !(target instanceof Block)) return 'invalid path';
    const sourceOrder = source.getValue('#order');
    const targetOrder = target.getValue('#order') ?? [];
    if (
      source.getProperty('#order', false)?._bindingSource ||
      target.getProperty('#order', false)?._bindingSource ||
      !isStringArray(sourceOrder) ||
      !isStringArray(targetOrder) ||
      !Array.isArray(props) ||
      !props.length ||
      new Set(props).size !== props.length ||
      !props.every((name) => typeof name === 'string' && sourceOrder.includes(name))
    )
      return 'invalid ordered children';
    const ordered = sourceOrder.filter((name) => props.includes(name)) as string[];
    if (ordered.length !== props.length) return 'invalid ordered children';
    const childrenTags = target._funcSrc?.getValue()?.desc.childrenTags;
    for (const name of ordered) {
      const prop = source.getProperty(name, false);
      const block = prop?._saved;
      if (!(block instanceof Block) || block._prop !== prop || block instanceof Flow) return 'invalid block';
      if (!childrenTags?.some((tag) => block._funcSrc?.getValue()?.desc.tags?.includes(tag))) {
        return 'incompatible children tags';
      }
    }
    let insertion = index ?? targetOrder.length;
    if (!Number.isInteger(insertion) || insertion < 0 || insertion > targetOrder.length) return 'invalid index';
    const remaining = sourceOrder.filter((name) => !props.includes(name));
    let moved = ordered;
    let newOrder: string[];
    if (source === target) {
      // index is a boundary in the original order, before removing the selected children.
      insertion -= sourceOrder.slice(0, insertion).filter((name) => props.includes(name)).length;
      newOrder = remaining;
    } else {
      const renames = new Map<string, string>();
      const result = moveBlocks(source, target, ordered, 'rename', renames);
      if (typeof result === 'string') return result;
      moved = ordered.map((name) => renames.get(name) ?? name);
      // Remove stale order entries with the incoming names so each child is inserted once.
      insertion -= targetOrder.slice(0, insertion).filter((name) => moved.includes(name)).length;
      newOrder = targetOrder.filter((name) => !moved.includes(name));
      source.setValue('#order', remaining);
    }
    newOrder.splice(insertion, 0, ...moved);
    target.setValue('#order', newOrder);
    getTrackedFlow(source, path, this.root).trackChange();
    if (source !== target) getTrackedFlow(target, to, this.root).trackChange();
    return {moved};
  }

  /**
   * Directly triggers the function of a Block, like the default `onCall` hook behavior
   */
  callFunction({path}: {path: string}) {
    const property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      if (property._value.getFunctionClass()) {
        property._value._onCall(new DoneEvent());
      }
      return null;
    } else {
      return 'invalid path';
    }
  }
}
