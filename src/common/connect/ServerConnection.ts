import {Connection, ConnectionSendingData, ConnectionSend} from "./Connection";
import {BlockIO, BlockProperty, BlockPropertyEvent, BlockPropertySubscriber} from "../block/BlockProperty";
import {DataMap, isSavedBlock, measureObjSize, truncateObj} from "../util/Types";
import {Root, Block, BlockBindingSource, BlockChildWatch} from "../block/Block";
import {Dispatcher, Listener, ValueDispatcher} from "../block/Dispatcher";
import Property = Chai.Property;
import {Type, Types, DescListener} from "../block/Type";
import {FunctionDesc} from "../block/Descriptor";
import {propRelative} from "../util/Path";

class ServerRequest extends ConnectionSendingData {
  id: string;
  connection: ServerConnection;

  /* istanbul ignore next */
  close(): void {
    // to be overridden
  }
}

class ServerSubscribe extends ServerRequest implements BlockPropertySubscriber, Listener<any> {
  property: BlockProperty;
  source: BlockBindingSource;

  fullValue: boolean;
  valueChanged = false;
  events: BlockPropertyEvent[] = [];

  constructor(conn: ServerConnection, id: string, prop: BlockProperty, fullValue: boolean) {
    super();
    this.id = id;
    this.connection = conn;
    this.property = prop;
    this.fullValue = fullValue;
    prop.subscribe(this);
    if (prop._bindingPath) {
      // add event for current bindingPath
      this.events.push({bind: prop._bindingPath});
    }
  }

  onSourceChange(prop: Dispatcher<any>) {
    if (prop !== this.property) {
      this.connection.sendError(this.id, "source changed");
      this.connection.close(this.id);
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

  getSendingData(): {data: DataMap, size: number} {
    let data: DataMap = {id: this.id, cmd: 'update'};
    let total = 0;
    if (this.valueChanged) {
      let value: any;
      let size: number;
      if (this.fullValue) {
        // don't truncate it
        value = this.property.getValue();
        size = measureObjSize(value);
      } else {
        [value, size] = truncateObj(this.property.getValue());
      }
      total += size;
      data.value = value;
      this.valueChanged = false;
    }
    let sendEvent: BlockPropertyEvent[] = [];
    let bindingChanged = false;
    let listenerChanged = false;
    if (this.events.length) {
      for (let e of this.events) {
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
      data.events = sendEvent;
      this.events = [];
    }
    if (bindingChanged) {
      data.bindingPath = this.property._bindingPath;
    }
    if (listenerChanged) {
      let hasListener = false;
      if (this.property._listeners) {
        for (let listener of this.property._listeners) {
          if (listener instanceof ValueDispatcher) {
            hasListener = true;
            break;
          }
        }
      }
      data.hasListener = hasListener;
    }
    return {data, size: total};
  }

  close() {
    this.source.unlisten(this);
    if (!this.property._block._destroyed) {
      this.property.unsubscribe(this);
    }
  }
}

class ServerWatch extends ServerRequest implements BlockChildWatch, Listener<any> {
  block: Block;
  property: BlockProperty;
  source: ValueDispatcher<any>;

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
  onSourceChange(prop: Dispatcher<any>): void {
    if (prop !== this.property) {
      this.connection.sendError(this.id, "source changed");
      this.connection.close(this.id);
    }
  }

  // Listener.onChange
  onChange(val: any): void {
    if (val !== this.block) {
      this.connection.sendError(this.id, "block changed");
      this.connection.close(this.id);
    }
  }

  _pendingChanges: {[key: string]: string} = null;
  _cached: Set<string> = new Set();

  // BlockChildWatch
  onChildChange(property: BlockIO, saved?: boolean) {
    if (this._pendingChanges) {
      let val = property._saved;
      if (saved && val instanceof Block) {
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

  getSendingData(): {data: DataMap, size: number} {
    let changes: {[key: string]: string};
    if (this._pendingChanges) {
      changes = this._pendingChanges;
    } else {
      changes = {};
      this.block.forEach((field: string, prop: BlockIO) => {
        if (prop._saved instanceof Block) {
          changes[field] = (prop._value as Block)._blockId;
          this._cached.add(field);
        }
      });
    }
    this._pendingChanges = {};
    let size = 0;
    for (let name in changes) {
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

  constructor(conn: ServerConnection, id: string) {
    super();
    this.id = id;
    this.connection = conn;
    this.pendingIds = new Set(Types.getAllTypeIds());
    Types.listenDesc(this);
    this.connection.addSend(this);
  }

  onDescChange(id: string, desc: FunctionDesc): void {
    this.pendingIds.add(id);
    this.connection.addSend(this);
  }

  getSendingData(): {data: DataMap, size: number} {
    let changes = [];
    let totalSize = 0;
    for (let id of this.pendingIds) {
      let [desc, size] = Types.getDesc(id);
      if (desc) {
        changes.push(desc);
        totalSize += size;
      } else {
        changes.push({id, removed: true});
        totalSize += id.length + 10;
      }
      this.pendingIds.delete(id);
      if (totalSize > 0x20000) {
        break;
      }
    }
    if (this.pendingIds.size !== 0) {
      this.connection.addSend(this);
    }
    return {data: {id: this.id, cmd: 'update', changes}, size: totalSize};
  }

  close() {
    Types.unlistenDesc(this);
  }
}

export class ServerConnection extends Connection {
  root: Root;

  requests: {[key: string]: ServerRequest} = {};

  constructor(root: Root) {

    super();
    this.root = root;
  }

  destroy() {
    for (let key in this.requests) {
      this.requests[key].close();
    }
    this.requests = null;
    super.destroy();
  }

  addRequest(id: string, req: ServerRequest) {
    if (this.requests.hasOwnProperty(id)) {
      this.requests[id].close();
    }
    this.requests[id] = req;
  }

  onData(request: DataMap) {
    if (typeof request.cmd === 'string' && typeof request.id === 'string') {
      if (request.cmd === 'close') {
        this.close(request.id);
        return;
      }
      if (typeof request.path === 'string') {
        let result: string | DataMap | ServerRequest;
        switch (request.cmd) {
          case 'set': {
            result = this.setValue(request.path, request.value);
            break;
          }
          case 'get': {
            result = this.getValue(request.path);
            break;
          }
          case 'bind': {
            result = this.setBinding(request.path, request.from, request.absolute);
            break;
          }
          case 'update': {
            result = this.updateValue(request.path, request.value);
            break;
          }
          case 'create' : {
            result = this.createBlock(request.path);
            break;
          }
          case 'command' : {
            break;
          }
          case 'subscribe' : {
            result = this.subscribeProperty(request.path, request.id, request.full);
            break;
          }
          case 'watch' : {
            result = this.watchBlock(request.path, request.id);
            break;
          }
          case 'list' : {
            result = this.listChildren(request.path, request.filter, request.max);
            break;
          }
          case 'addType': {
            break;
          }
          case 'watchDesc' : {
            result = this.watchDesc(request.id);
            break;
          }
        }
        if (result instanceof ServerRequest) {
          this.addRequest(request.id, result);
        } else if (result) {
          if (typeof result === 'string') {
            this.sendError(request.id, result);
          } else {
            this.sendFinal(request.id, result);
          }
        } else {
          this.sendDone(request.id);
        }
      }
    }
  }

  sendError(id: string, msg: string) {
    this.addSend(new ConnectionSend({'cmd': 'error', 'id': id, 'msg': msg}));
  }

  sendDone(id: string) {
    this.addSend(new ConnectionSend({'cmd': 'done', 'id': id}));
  }

  sendFinal(id: string, data: DataMap) {
    this.addSend(new ConnectionSend({...data, 'cmd': 'final', 'id': id}));
  }


  close(id: string) {
    if (this.requests.hasOwnProperty(id)) {
      this.requests[id].close();
      delete this.requests[id];
    }
  }

  setValue(path: string, val: any): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      property.setValue(val);
      return null;
    } else {
      return 'invalid path';
    }
  }

  getValue(path: string): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      // TODO
      return null;
    } else {
      return 'invalid path';
    }
  }

  updateValue(path: string, val: any): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      property.updateValue(val);
      return null;
    } else {
      return 'invalid path';
    }
  }

  setBinding(path: string, from: string, absolute: boolean): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      if (absolute) {
        let fromProp = this.root.queryProperty(from, true);
        if (fromProp) {
          property.setBinding(propRelative(property._block, fromProp));
        } else {
          return 'invalid from path';
        }
      } else {
        property.setBinding(from);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  createBlock(path: string): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      if (property._value instanceof Block && property._value._prop === property) {
        return 'block already exists';
      }
      property._block.createBlock(property._name);
      return null;
    } else {
      return 'invalid path';
    }
  }

  listChildren(path: string, filter: string, max: number): string | DataMap {
    let property = this.root.queryProperty(path, true);
    if (!(max > 0 && max < 1024)) {
      max = 16;
    }
    if (property && property._value instanceof Block) {
      let block = property._value;
      let filterRegex: RegExp;
      let children: DataMap = {};
      if (filter) {
        filterRegex = new RegExp(filter);
      }
      let count = 0;
      block.forEach((field: string, prop: BlockIO) => {
        if (prop._value instanceof Block) {
          if (!filterRegex || filterRegex.test(field)) { // filter
            if (count < max) {
              children[field] = (prop._value as Block)._blockId;
            }
            ++count;
          }
        }
      });
      return {children, count};
    } else {
      return 'invalid path';
    }

  }

  subscribeProperty(path: string, id: string, fullValue: boolean): string | ServerSubscribe {
    let property = this.root.queryProperty(path, true);
    if (property) {
      let subscriber = new ServerSubscribe(this, id, property, fullValue);
      subscriber.source = this.root.createBinding(path, subscriber);
      return subscriber;
    } else {
      return 'invalid path';
    }
  }

  watchBlock(path: string, id: string): string | ServerWatch {
    let property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Block) {
      let watch = new ServerWatch(this, id, property._value, property);
      watch.source = this.root.createBinding(path, watch);
      return watch;
    } else {
      return 'invalid path';
    }
  }

  watchDesc(id: string): ServerDescWatcher {
    return new ServerDescWatcher(this, id);
  }

  blockCommand(path: string, command: string, params: DataMap) {
    // TODO
  }

}
