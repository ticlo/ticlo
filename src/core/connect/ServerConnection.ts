import {Connection, ConnectionSendingData, ConnectionSend} from './Connection';
import {
  BlockBindingSource,
  BlockIO,
  BlockProperty,
  BlockPropertyEvent,
  BlockPropertySubscriber,
  HelperProperty,
} from '../block/BlockProperty';
import {DataMap, isPrimitiveType} from '../util/DataTypes';
import {truncateData} from '../util/DataTruncate';
import {Block, BlockChildWatch, InputsBlock} from '../block/Block';
import {Flow, Root} from '../block/Flow';
import {FlowWithShared, SharedBlock, SharedConfig} from '../block/SharedBlock';
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
import {FlowEditor} from '../worker/FlowEditor';
import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../property-api/OptionalProperty';
import {WorkerFunction} from '../worker/WorkerFunction';
import {isBindable} from '../util/Path';
import {ClientCallbacks} from './ClientRequests';
import {copyProperties, createSharedBlock, deleteProperties, pasteProperties} from '../property-api/CopyPaste';
import {moveProperty, PropertyMover} from '../property-api/PropertyMover';
import {BlockInputsConfig, BlockOutputsConfig} from '../block/BlockConfigs';
import {WorkerFlow} from '../worker/WorkerFlow';
import {Query, queryBlock} from './Query';
import {getGlobalSettings} from '../block/Settings';

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
    let data: DataMap = {id: this.id, cmd: 'update'};
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
        [value, size] = truncateData(value);
        total += size;
        data.value = value;
      }
      this.valueChanged = false;
      updateNeeded = true;
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
      if (sendEvent.length) {
        data.events = sendEvent;
        updateNeeded = true;
      }
      this.events = [];
    }
    if (bindingChanged) {
      data.bindingPath = this.property._bindingPath;
      updateNeeded = true;
    }
    if (listenerChanged) {
      let hasListener = false;
      if (this.property._listeners) {
        for (let listener of this.property._listeners) {
          if (listener instanceof PropDispatcher) {
            if (listener instanceof BlockProperty && listener._block instanceof InputsBlock && !listener._bindingPath) {
              // InputsBlock is a special case, don't show hasListener dot
            } else {
              hasListener = true;
            }
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

function getTrackedFlow(block: Block, path: string, root: Root): Flow {
  let flow: Flow;
  if (path.endsWith('.@b-xyw')) {
    flow = block._parent._flow;
  } else {
    flow = block._flow;
  }
  if (flow instanceof SharedBlock) {
    let sharedPos = path.lastIndexOf('.#shared.');
    if (sharedPos > 0) {
      let sharedProp = root.queryProperty(path.substring(0, sharedPos + 8));
      if (sharedProp instanceof SharedConfig) {
        flow = sharedProp._block._flow;
      }
    }
  }
  return flow;
}

function trackChange(property: BlockProperty, path: string, root: Root) {
  getTrackedFlow(property._block, path, root).trackChange();
}

class ServerConnectionCore extends Connection {
  requests: {[key: string]: ServerRequest} = {};

  constructor(public root: Root) {
    super();
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
        let result: string | DataMap | ServerRequest = 'invalid command';
        let cmd: string = request.cmd;
        if (ServerConnection.prototype.hasOwnProperty(cmd)) {
          let func: Function = (this as any)[cmd];
          if (typeof func === 'function' && func.length === 1 && !cmd.startsWith('on')) {
            result = func.call(this, request);
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
      } else {
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

  destroy() {
    for (let key in this.requests) {
      this.requests[key].close();
    }
    this.requests = null;
    super.destroy();
  }
}

export class ServerConnection extends ServerConnectionCore {
  getSettings({id}: {id: string}) {
    return getGlobalSettings().getData();
  }

  // set value
  set({path, value}: {path: string; value: any}): string {
    let property = this.root.queryProperty(path, value !== undefined);
    if (property) {
      if (property._value instanceof Flow) {
        this.root.deleteFlow(path);
      }
      property.setValue(value);
      trackChange(property, path, this.root);
      return null;
    } else if (value !== undefined) {
      return 'invalid path';
    }
  }

  // get value
  get({path}: {path: string}): DataMap | string {
    let property = this.root.queryProperty(path);
    if (property === null) {
      // property === undefined, parent block exists but property is not created
      return {};
    } else if (property) {
      return {value: property._value};
    } else {
      // property === undefined, parent block doesn't exist
      return 'invalid path';
    }
  }

  query({path, query}: {path: string; query: Query}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      return {value: queryBlock(property._value, query)};
    } else {
      return 'invalid path';
    }
  }

  // update value
  update({path, value}: {path: string; value: any}): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      property.updateValue(value);
      return null;
    } else {
      return 'invalid path';
    }
  }

  // restore saved value if current value not equal to saved value
  restoreSaved({path}: {path: string}): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      if (!Object.is(property._saved, property._value) && !property._bindingSource) {
        property.updateValue(property._saved);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  // set binding
  bind({path, from, absolute}: {path: string; from: string; absolute: boolean}): string {
    let property = this.root.queryProperty(path, true);
    if (property) {
      if (absolute) {
        if (from == null) {
          // remove binding but keep current primitive value
          let val = property._value;
          if (isPrimitiveType(val)) {
            property.setValue(val);
          } else {
            property.setValue(undefined);
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

  addFlow({path, data}: {path: string; data?: DataMap}): string | DataMap {
    if (this.root.addFlow(path, data)) {
      return null;
    } else {
      return 'invalid path';
    }
  }

  addBlock({path, data, anyName}: {path: string; data?: DataMap; anyName?: boolean}): string | DataMap {
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
      let funcId = data?.['#is'];
      if (typeof funcId === 'string' && funcId.startsWith('flow:')) {
        if (funcId === 'flow:inputs') {
          property = property._block.getProperty('#inputs');
          if (property instanceof BlockInputsConfig && property.isCleared()) {
            let inputBlock = property._block.createBlock('#inputs');
            if (property._block instanceof Flow) {
              let defaultFlow = property._block._parent.getDefaultWorker(null);
              let inputs = defaultFlow?.['#inputs'];
              if (Object.isExtensible(inputs)) {
                inputBlock._load({...data, ...(inputs as DataMap)});
                // Since data is already loaded, we can skip the next load.
                data = null;
                (property._block as WorkerFlow).updateInput(property._block._lastInput);
              }
            }
          } else {
            return 'invalid path';
          }
        } else if (funcId === 'flow:outputs') {
          property = property._block.getProperty('#outputs');
          if (property instanceof BlockOutputsConfig && property.isCleared()) {
            let outputBlock = property._block.createBlock('#outputs');
            if (property._block instanceof Flow) {
              let defaultFlow = property._block._parent.getDefaultWorker(null);
              let inputs = defaultFlow?.['#outputs'];
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
      } else if (anyName) {
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
      if (typeof funcId === 'string' && data) {
        (property._value as Block)._load(data);
        let desc = Functions.getDescToSend(funcId)[0];
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

  list({path, filter, max}: {path: string; filter: string; max: number}): string | DataMap {
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

  subscribe({path, id}: {path: string; id: string}): string | ServerSubscribe {
    let property = this.root.queryProperty(path, true);
    if (property) {
      let subscriber = new ServerSubscribe(this, id, property);
      subscriber.source = this.root.createBinding(path, subscriber);
      return subscriber;
    } else {
      return 'invalid path';
    }
  }

  watch({path, id}: {path: string; id: string}): string | ServerWatch {
    let property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Block) {
      let watch = new ServerWatch(this, id, property._value, property);
      watch.source = this.root.createBinding(path, watch);
      return watch;
    } else {
      return 'invalid path';
    }
  }

  watchDesc({id}: {id: string}): ServerDescWatcher {
    return new ServerDescWatcher(this, id);
  }

  executeCommand({path, command, params}: {path: string; command: string; params: DataMap}) {
    if (typeof command !== 'string') {
      return 'invalid command';
    }
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      let result = property._value.executeCommand(command, params);
      if (result != null) {
        return {result};
      }
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  editWorker({
    path,
    fromField,
    fromFunction,
    defaultData,
  }: {
    path: string;
    fromField: string;
    fromFunction: string;
    defaultData: DataMap;
  }) {
    let property = this.root.queryProperty(path, true);

    if (property && property._name.startsWith('#edit-')) {
      if (fromField) {
        FlowEditor.createFromField(property._block, property._name, fromField);
      } else if (fromFunction && fromFunction.startsWith(':')) {
        FlowEditor.createFromFunction(property._block, property._name, fromFunction, defaultData);
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  applyFlowChange({path, funcId}: {path: string; funcId: string}) {
    let property = this.root.queryProperty(path, true);
    if (property && property._value instanceof Flow) {
      if (funcId && property._value instanceof FlowEditor) {
        WorkerFunction.applyChangeToFunc(property._value, funcId);
      } else {
        property._value.applyChange();
        if (property._block._flow._history?.hasChange()) {
          trackChange(property, path, this.root);
        }
      }
      return null;
    } else {
      return 'invalid path';
    }
  }

  deleteFunction({funcId}: {funcId: string}): string {
    if (funcId.startsWith(':')) {
      Functions.clear(funcId);
    }
    return null;
  }

  showProps({path, props}: {path: string; props: string[]}) {
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

  hideProps({path, props}: {path: string; props: string[]}) {
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

  moveShownProp({path, propFrom, propTo}: {path: string; propFrom: string; propTo: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveShownProperty(property._value, propFrom, propTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  setLen({path, group, length}: {path: string; group: string; length: number}) {
    let property = this.root.queryProperty(path, true);

    if (property && property._value instanceof Block) {
      setGroupLength(property._value, group, length);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  renameProp({path, newName}: {path: string; newName: string}) {
    let property = this.root.queryProperty(path, true);

    if (property) {
      let existingProp = property._block.getProperty(newName, false);
      if (existingProp?._saved instanceof Block) {
        return 'invalid new name';
      }
      return moveProperty(property._block, property._name, newName, true);
    } else {
      return 'invalid path';
    }
  }

  addCustomProp({path, desc, group}: {path: string; desc: PropDesc | PropGroupDesc; group: string}) {
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

  removeCustomProp({path, name, group}: {path: string; name: string; group: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeCustomProperty(property._value, name, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveCustomProp({path, nameFrom, nameTo, group}: {path: string; nameFrom: string; nameTo: string; group: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveCustomProperty(property._value, nameFrom, nameTo, group);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  addOptionalProp({path, name}: {path: string; name: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      addOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  removeOptionalProp({path, name}: {path: string; name: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeOptionalProperty(property._value, name);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveOptionalProp({path, nameFrom, nameTo}: {path: string; nameFrom: string; nameTo: string}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveOptionalProperty(property._value, nameFrom, nameTo);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  insertGroupProp({path, group, idx}: {path: string; group: string; idx: number}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      insertGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  removeGroupProp({path, group, idx}: {path: string; group: string; idx: number}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      removeGroupProperty(property._value, group, idx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  moveGroupProp({path, group, oldIdx, newIdx}: {path: string; group: string; oldIdx: number; newIdx: number}) {
    let property = this.root.queryProperty(path);

    if (property && property._value instanceof Block) {
      moveGroupProperty(property._value, group, oldIdx, newIdx);
      trackChange(property, path, this.root);
      return null;
    } else {
      return 'invalid path';
    }
  }

  undo({path}: {path: string}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedFlow(property._value, path, this.root).undo();
      return null;
    } else {
      return 'invalid path';
    }
  }

  redo({path}: {path: string}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      getTrackedFlow(property._value, path, this.root).redo();
      return null;
    } else {
      return 'invalid path';
    }
  }

  copy({path, props, cut}: {path: string; props: string[]; cut: boolean}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      let value = copyProperties(property._value, props);
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

  paste({path, data, resolve}: {path: string; data: DataMap; resolve?: 'overwrite' | 'rename'}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      let result = pasteProperties(property._value, data, resolve);
      if (typeof result === 'string') {
        return result;
      }
      getTrackedFlow(property._value, path, this.root).trackChange();
      return {pasted: result};
    } else {
      return 'invalid path';
    }
  }

  callFunction({path}: {path: string}) {
    let property = this.root.queryProperty(path);
    if (property && property._value instanceof Block) {
      if (property._value.getFunctionClass()) {
        property._value._queueFunction();
      }
      return null;
    } else {
      return 'invalid path';
    }
  }
}
