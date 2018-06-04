import { Connection, ConnectionSendingData, ConnectionSend } from "./Connection";
import { BlockProperty, BlockPropertyEvent, BlockPropertySubscriber } from "../block/BlockProperty";
import { Root } from "../block/Job";
import { DataMap, isSavedBlock, truncateObj } from "../util/Types";
import { Block } from "../block/Block";
import { Dispatcher, Listener } from "../block/Dispatcher";

class ServerRequest extends ConnectionSendingData {
  id: string;
  connection: ServerConnection;

  /* istanbul ignore next */
  close(): void {
    // to be overridden
  }
}

class ServerSubscribe extends ServerRequest implements BlockPropertySubscriber, Listener<any> {
  id: string;
  connection: ServerConnection;
  property: BlockProperty;

  valueChanged = false;
  events: BlockPropertyEvent[] = [];

  constructor(conn: ServerConnection, id: string, prop: BlockProperty) {
    super();
    this.id = id;
    this.connection = conn;
    this.property = prop;
    prop.listen(this);
    prop.subscribe(this);
  }

  onSourceChange(prop: Dispatcher<any>) {
    if (prop !== this.property) {
      this.connection.sendError(this.id, "source changed");
      this.close();
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

  getSendingData(): { data: DataMap, size: number } {
    let data: DataMap = {id: this.id, cmd: 'update'};
    let total = 0;
    if (this.valueChanged) {
      let [value, size] = truncateObj(this.property.getValue());
      total += size;
      data.value = value;
      this.valueChanged = false;
    }
    let sendEvent: BlockPropertyEvent[] = [];
    let bindingChanged = false;
    if (this.events.length) {
      for (let e of this.events) {
        if (e.bind) {
          // extract and merge binding event
          bindingChanged = true;
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
    return {data, size: total};
  }

  close() {
    this.property.unlisten(this);
    this.property.unsubscribe(this);
  }
}

class ServerWatch extends ServerRequest {

  close() {
    //TODO
  }
}

export class ServerConnection extends Connection {
  root: Root;

  requests: { [key: string]: ServerRequest } = {};

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
        let result: string | ServerRequest;
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
            result = this.setBinding(request.path, request.from);
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
            result = this.subscribeProperty(request.path, request.id);
            break;
          }
          case 'watch' : {
            break;
          }
          case 'listClasses' : {
            break;
          }
          case 'addClass': {
            break;
          }
        }
        if (result instanceof ServerRequest) {
          this.addRequest(request.id, result);
        } else if (result) {
          this.sendError(request.id, result);
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

  close(id: string) {
    if (this.requests.hasOwnProperty(id)) {
      this.requests[id].close();
      delete this.requests[id];
    }
  }

  setValue(path: string, val: any): string {
    if (val === undefined || isSavedBlock(val)) {
      return "invalid value";
    }
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
      return null;
    } else {
      return 'invalid path';
    }
  }

  updateValue(path: string, val: any): string {
    if (val === undefined || isSavedBlock(val)) {
      return "invalid value";
    }
    let property = this.root.queryProperty(path, true);
    if (property) {
      property.updateValue(val);
      return null;
    } else {
      return 'invalid path';
    }
  }

  setBinding(path: string, from: string): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      property.setBinding(from);
      return null;
    } else {
      return 'invalid path';
    }
  }

  createBlock(path: string): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      if (property._value instanceof Block && property._value._prop === property) {
        return 'Block already exists';
      }
      property._block.createBlock(property._name);
      return null;
    } else {
      return 'invalid path';
    }
  }

  subscribeProperty(path: string, id: string): string | ServerSubscribe {
    let property = this.root.queryProperty(path, true);
    if (property) {
      return new ServerSubscribe(this, id, property);
    } else {
      return 'invalid path';
    }
  }

  watchBlock(path: string) {
    // TODO
  }

  blockCommand(path: string, command: string, params: DataMap) {
    // TODO
  }

}
