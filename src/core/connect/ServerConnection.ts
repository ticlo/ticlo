import {Connection, ConnectionSendingData, ConnectionSend} from './Connection';
import {
  BlockBindingSource,
  BlockIO,
  BlockProperty,
  BlockPropertyEvent,
  BlockPropertySubscriber,
  HelperProperty,
} from '../block/BlockProperty';
import {DataMap, isPrimitiveType, truncateData} from '../util/DataTypes';
import {Block, BlockChildWatch, InputsBlock} from '../block/Block';
import {Job, Root} from '../block/Job';
import {JobWithShared, SharedBlock, SharedConfig} from '../block/SharedBlock';
import {PropDispatcher, PropListener} from '../block/Dispatcher';
import {Functions, DescListener} from '../block/Functions';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {propRelative} from '../util/PropPath';
import {
  insertGroupProperty,
  moveGroupProperty,
  removeGroupProperty,
  setGroupLength,
} from '../property-api/GroupProperty';
import {findPropertyForNewBlock} from '../property-api/PropertyName';
import {hideProperties, moveShownProperty, showProperties} from '../property-api/PropertyShowHide';
import {addCustomProperty, moveCustomProperty, removeCustomProperty} from '../property-api/CustomProperty';
import {JobEditor} from '../worker/JobEditor';
import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../property-api/OptionalProperty';
import {WorkerFunction} from '../worker/WorkerFunction';
import {isBindable} from '../util/Path';
import {ClientCallbacks} from './ClientRequests';
import {createSharedBlock} from '../property-api/CopyPaste';

class ServerRequest extends ConnectionSendingData {
  id: string;
  connection: ServerConnection;

  /* istanbul ignore next */
  close(): void {
    // to be overridden
  }
}

class ServerSubscribe extends ServerRequest implements BlockPropertySubscriber, PropListener<any> {
  property: BlockProperty;
  source: BlockBindingSource;

  valueChanged = false;
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
    let data: DataMap = {id: this.id, cmd: 'update'};
    let total = 0;
    if (this.valueChanged) {
      let value: any;
      let size: number;
      [value, size] = truncateData(this.property.getValue());
      total += size;
      data.value = value;
      if (value === undefined) {
        data.undefined = true;
      }
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
          if (listener instanceof PropDispatcher) {
            if (listener instanceof BlockProperty && listener._block instanceof InputsBlock && !listener._bindingPath) {
              // InputsBlock is a special case, dont show hasListener dot
            } else {
              hasListener = true;
            }
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
      let val = property._saved;
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
    this.pendingIds = new Set(Functions.getAllFunctionIds());
    Functions.listenDesc(this);
    this.connection.addSend(this);
  }

  onDescChange(id: string, desc: FunctionDesc): void {
    this.pendingIds.add(id);
    this.connection.addSend(this);
  }

  getSendingData(): {data: DataMap; size: number} {
    let changes = [];
    let totalSize = 0;
    for (let id of this.pendingIds) {
      let [desc, size] = Functions.getDescToSend(id);
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
    Functions.unlistenDesc(this);
  }
}

function getTrackedJob(block: Block, path: string, root: Root): Job {
  let job: Job;
  if (path.endsWith('.@b-xyw')) {
    job = block._parent._job;
  } else {
    job = block._job;
  }
  if (job instanceof SharedBlock) {
    let sharedPos = path.lastIndexOf('.#shared.');
    if (sharedPos > 0) {
      let sharedProp = root.queryProperty(path.substring(0, sharedPos + 8));
      if (sharedProp instanceof SharedConfig) {
        job = sharedProp._block._job;
      }
    }
  }
  return job;
}
function trackChange(property: BlockProperty, path: string, root: Root) {
  getTrackedJob(property._block, path, root).trackChange();
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
          case 'create': {
            result = this.createBlock(request.path, request.data, request.anyName);
            break;
          }
          case 'addJob': {
            result = this.addJob(request.path, request.data);
            break;
          }
          case 'command': {
            break;
          }
          case 'subscribe': {
            result = this.subscribeProperty(request.path, request.id);
            break;
          }
          case 'watch': {
            result = this.watchBlock(request.path, request.id);
            break;
          }
          case 'list': {
            result = this.listChildren(request.path, request.filter, request.max);
            break;
          }
          case 'addType': {
            break;
          }
          case 'watchDesc': {
            result = this.watchDesc(request.id);
            break;
          }
          case 'editWorker': {
            result = this.editWorker(request.path, request.fromField, request.fromFunction, request.defaultData);
            break;
          }
          case 'applyJobChange': {
            result = this.applyJobChange(request.path, request.funcId);
            break;
          }
          case 'deleteFunction': {
            result = this.deleteFunction(request.funcId);
            break;
          }
          //// property utils

          case 'showProps': {
            result = this.showProps(request.path, request.props);
            break;
          }
          case 'hideProps': {
            result = this.hideProps(request.path, request.props);
            break;
          }
          case 'moveShownProp': {
            result = this.moveShownProp(request.path, request.propFrom, request.propTo);
            break;
          }
          case 'setLen': {
            result = this.setLen(request.path, request.group, request.length);
            break;
          }
          case 'addCustomProp': {
            result = this.addCustomProp(request.path, request.desc, request.group);
            break;
          }
          case 'removeCustomProp': {
            result = this.removeCustomProp(request.path, request.name, request.group);
            break;
          }
          case 'moveCustomProp': {
            result = this.moveCustomProp(request.path, request.nameFrom, request.nameTo, request.group);
            break;
          }
          case 'addOptionalProp': {
            result = this.addOptionalProp(request.path, request.name);
            break;
          }
          case 'removeOptionalProp': {
            result = this.removeOptionalProp(request.path, request.name);
            break;
          }
          case 'moveOptionalProp': {
            result = this.moveOptionalProp(request.path, request.nameFrom, request.nameTo);
            break;
          }
          case 'insertGroupProp': {
            result = this.insertGroupProp(request.path, request.group, request.idx);
            break;
          }
          case 'removeGroupProp': {
            result = this.removeGroupProp(request.path, request.group, request.idx);
            break;
          }
          case 'moveGroupProp': {
            result = this.moveGroupProp(request.path, request.group, request.oldIdx, request.newIdx);
            break;
          }
          case 'undo': {
            result = this.undo(request.path);
            break;
          }
          case 'redo': {
            result = this.redo(request.path);
            break;
          }
          default:
            result = 'invalid command';
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
      } else if (request.id != null) {
        this.sendError(request.id, 'invalid path');
      }
    }
  }

  sendError(id: string, msg: string) {
    this.addSend(new ConnectionSend({cmd: 'error', id, msg}));
  }

  sendDone(id: string) {
    this.addSend(new ConnectionSend({cmd: 'done', id}));
  }

  sendFinal(id: string, data: DataMap) {
    this.addSend(new ConnectionSend({...data, cmd: 'final', id}));
  }

  close(id: string) {
    if (this.requests.hasOwnProperty(id)) {
      this.requests[id].close();
      delete this.requests[id];
    }
  }

  setValue(path: string, val: any): string {
    let property = this.root.queryProperty(path, val !== undefined);
    if (property) {
      property.setValue(val);
      trackChange(property, path, this.root);
      return null;
    } else if (val !== undefined) {
      return 'invalid path';
    }
  }

  getValue(path: string): DataMap | string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      return {value: property._value};
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
        if (from == null) {
          // remove binding but keep current primitive value
          let val = property._value;
          if (isPrimitiveType(val)) {
            property.setValue(val);
          } else {
            property.setBinding(undefined);
          }
        } else {
          let fromParts = from.split('..');
          let bindable = isBindable(path, fromParts[0]);
          if (!bindable) {
            return 'invalid binding path';
          }
          let fromProp = this.root.queryProperty(fromParts[0], true);
          if (fromProp) {
            let resolvedFrom: string;
            if (from.startsWith('#global.^')) {
              resolvedFrom = from.substring(8);
            } else {
              let fromSharedPos = from.lastIndexOf('.#shared.');
              if (bindable === 'shared') {
                let sharedPath = from.substring(0, fromSharedPos + 8); // path to #shared
                let sharedProp = this.root.queryProperty(sharedPath);
                if (sharedProp instanceof SharedConfig) {
                  let afterShared = from.substring(fromSharedPos + 9);
                  resolvedFrom = `${propRelative(property._block, sharedProp)}.${afterShared}`;
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

  addJob(path: string, data?: DataMap): string | DataMap {
    if (this.root.addJob(path, data)) {
      return null;
    } else {
      return 'invalid path';
    }
  }

  createBlock(path: string, data?: DataMap, anyName?: boolean): string | DataMap {
    let property = this.root.queryProperty(path, true);
    if (!property && /\.#shared\.[^.]+$/.test(path)) {
      let sharedPath = path.substring(0, path.lastIndexOf('.'));
      let sharedProp = this.root.queryProperty(sharedPath, true);
      // create shared block when possible
      if (createSharedBlock(sharedProp)) {
        // get the property again
        property = this.root.queryProperty(path, true);
      }
    }
    if (property) {
      let keepSaved: any;
      let keepBinding: string;
      if (anyName) {
        property = findPropertyForNewBlock(property._block, property._name);
        property._block.createBlock(property._name);
      } else {
        if (property instanceof HelperProperty) {
          // create a sub block and move the current property into the sub block if possible
          let baseProperty = property._block.getProperty(property._name.substring(1));
          // check the current value and binding
          if (baseProperty._saved !== undefined) {
            if (!(baseProperty._saved instanceof Block)) {
              keepSaved = baseProperty._saveValue();
            }
          } else if (baseProperty._bindingPath) {
            keepBinding = baseProperty._bindingPath;
            if (!(keepBinding.startsWith('###.') || keepBinding.startsWith('^'))) {
              // point the binding path to parent object
              keepBinding = `##.${keepBinding}`;
            }
          }
          property.setValue(undefined);
          property._block.createHelperBlock(baseProperty._name);
        } else {
          property.setValue(undefined);
          property._block.createBlock(property._name);
        }
      }
      if (data && data.hasOwnProperty('#is')) {
        (property._value as Block)._load(data);
        let desc = Functions.getDescToSend(data['#is'])[0];
        if (desc && desc.recipient && !data.hasOwnProperty(desc.recipient)) {
          // transfer parent property to the recipient
          if (keepSaved !== undefined) {
            (property._value as Block).getProperty(desc.recipient)._liveUpdate(keepSaved);
          } else if (keepBinding) {
            (property._value as Block).setBinding(desc.recipient, keepBinding);
          }
        }
      }
      trackChange(property, path, this.root);
      return {name: property._name};
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
      for (let [field, prop] of block._props) {
        if (prop._value instanceof Block && prop._value._prop === prop) {
          if (!filterRegex || filterRegex.test(field)) {
            // filter
            if (count < max) {
              let result: any = {id: (prop._value as Block)._blockId};
              if (prop._value instanceof Job && prop._value._applyChange) {
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

  subscribeProperty(path: string, id: string): string | ServerSubscribe {
    let property = this.root.queryProperty(path, true);
    if (property) {
      let subscriber = new ServerSubscribe(this, id, property);
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

  editWorker(path: string, fromField: string, fromFunction: string, defaultData: DataMap) {
    let property = this.root.queryProperty(path, true);

    if (property && property._name.startsWith('#edit-')) {
      if (fromField) {
        JobEditor.createFromField(property._block, property._name, fromField);
      } else if (fromFunction && fromFunction.startsWith(':')) {
        JobEditor.createFromFunction(property._block, property._name, fromFunction, defaultData);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  applyJobChange(path: string, funcId: string) {
    let property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Job) {
      if (funcId && property._value instanceof JobEditor) {
        WorkerFunction.applyChangeToFunc(property._value, funcId);
      } else {
        property._value.applyChange();
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  deleteJob(property: BlockProperty) {
    let job = property.getValue();
    if (job instanceof Job) {
      this.root.deleteJob(property._name);
    }
  }

  deleteFunction(funcId: string): string {
    if (funcId.startsWith(':')) {
      Functions.clear(funcId);
    }
    return null;
  }

  showProps(path: string, props: string[]) {
    if (!Array.isArray(props)) {
      return 'invalid properties';
    }
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      showProperties(property._value, props);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  hideProps(path: string, props: string[]) {
    if (!Array.isArray(props)) {
      return 'invalid properties';
    }
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      hideProperties(property._value, props);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveShownProp(path: string, propFrom: string, propTo: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveShownProperty(property._value, propFrom, propTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  setLen(path: string, group: string, length: number) {
    let property = this.root.queryProperty(path, true);

    if (property && property._value instanceof Block) {
      setGroupLength(property._value, group, length);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  addCustomProp(path: string, desc: PropDesc | PropGroupDesc, group: string) {
    if (!(desc instanceof Object && typeof desc.name === 'string')) {
      // TODO, full validation
      return 'invalid desc';
    }
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      addCustomProperty(property._value, desc, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  removeCustomProp(path: string, name: string, group: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeCustomProperty(property._value, name, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveCustomProp(path: string, nameFrom: string, nameTo: string, group: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveCustomProperty(property._value, nameFrom, nameTo, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  addOptionalProp(path: string, name: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      addOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  removeOptionalProp(path: string, name: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveOptionalProp(path: string, nameFrom: string, nameTo: string) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveOptionalProperty(property._value, nameFrom, nameTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  insertGroupProp(path: string, group: string, idx: number) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      insertGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  removeGroupProp(path: string, group: string, idx: number) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveGroupProp(path: string, group: string, oldIdx: number, newIdx: number) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveGroupProperty(property._value, group, oldIdx, newIdx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  undo(path: string) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedJob(property._value, path, this.root).undo();
      return null;
    } else {
      return 'invalid path';
    }
  }
  redo(path: string) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedJob(property._value, path, this.root).redo();
      return null;
    } else {
      return 'invalid path';
    }
  }

  copy(path: string, blocks: string[], cut: boolean) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {

      return null;
    } else {
      return 'invalid path';
    }
  }
  paste(path: string, data: DataMap) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedJob(property._value, path, this.root).trackChange();
      return null;
    } else {
      return 'invalid path';
    }
  }
}
