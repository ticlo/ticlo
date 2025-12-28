import {Block, BlockChildWatch, InputsBlock, Runnable} from './Block.js';
import {BlockConfig, BlockIO, BlockProperty, ContextProperty} from './BlockProperty.js';
import {Resolver} from './Resolver.js';
import {
  BlockConstConfig,
  ConstTypeConfig,
  FlowConfigGenerators,
  FlowFolderConfigGenerators,
  GlobalConfigGenerators,
} from './BlockConfigs.js';
import {Event} from './Event.js';
import {DataMap} from '../util/DataTypes.js';
import {FunctionDesc} from './Descriptor.js';
import {Functions} from './Functions.js';
import {FlowStorage} from './Storage.js';
import {FlowHistory} from './FlowHistory.js';
import {getDefaultZone, updateGlobalSettings} from '../util/Settings.js';
import {DataWrapper, FunctionOutput} from './FunctonData.js';
import {Namespace} from './Namespace.js';

export enum FlowState {
  enabled,
  disabled,
  destroyed,
}
export interface FlowLoader {
  createFlow?(path: string, prop: BlockProperty): Flow;
  createFolder?(path: string, prop: BlockProperty): FlowFolder;
  applyChange?(data: DataMap): boolean;
  onStateChange?(flow: Flow, state: FlowState): void;
}

export class Flow extends Block {
  _namespace: string;
  // function id, when Flow is loaded from a function
  _loadFrom: string;
  _storageKey: string;

  _enabled: boolean = true;
  _loading: boolean = false;

  _outputObj?: FunctionOutput;

  _history: FlowHistory;

  readonly _depth: number;

  constructor(parent: Block = Root.instance, output?: FunctionOutput, property?: BlockProperty, storageKey?: string) {
    super(null, null, property);
    this._flow = this;
    this._parent = parent;
    this._depth = parent ? parent._flow._depth + 1 : 0;
    this._outputObj = output;
    this._storageKey = storageKey;
    if (!property) {
      this._prop = new BlockProperty(this, '');
    }
    if (parent) {
      this._disabled = this._parent._flow._disabled;
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowConfigGenerators) {
      return new FlowConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  _disabledChanged(disabled: unknown) {
    const newDisabled = this._parent._flow._disabled || Boolean(disabled);
    if (newDisabled !== this._disabled) {
      this._disabled = newDisabled;
      if (newDisabled) {
        this._disableBlock();
      } else {
        this._enabledBlock();
      }
    }
  }

  // override default behavior, dont directly call _flowDisabled on children
  _flowDisabled() {
    this._disabledChanged(true);
  }

  // override default behavior, dont directly call _flowEnabled on children
  _flowEnabled() {
    this._disabledChanged(this.getValue('#disabled'));
  }

  _disableBlock() {
    this._onStateChange?.(this, FlowState.disabled);
    for (const [key, prop] of this._props) {
      const val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowDisabled();
      }
    }
  }

  _enabledBlock() {
    this._onStateChange?.(this, FlowState.enabled);
    for (const [key, prop] of this._props) {
      const val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowEnabled();
      }
    }
  }

  createContextProperty(name: string): BlockProperty {
    const prop = new ContextProperty(this, name);
    this._props.set(name, prop);
    return prop;
  }

  getContextProperty(name: string): BlockProperty {
    return this.getProperty(name);
  }

  queueBlock(block: Runnable) {
    this._parent._flow.queueBlock(block);
  }

  // return true when the related output block need to be put in queue
  outputChanged(input: BlockIO, val: unknown): boolean {
    if (this._outputObj) {
      this._outputObj.output(val, input._name);
    }
    return false;
  }

  _lastInput: unknown;
  updateInput(val: unknown) {
    this._lastInput = val;
    const prop = this.getProperty('#inputs');
    if (prop._value instanceof InputsBlock) {
      prop._value._setInputValue(val);
    } else {
      prop.updateValue(val);
    }
  }

  cancel() {
    this.getProperty('#cancel').updateValue(new Event('cancel'));
  }

  _save(): DataMap {
    // flow shouldn't be saved within parent Block
    return undefined;
  }

  save(): DataMap {
    return super._save();
  }

  _applyChange: (data: DataMap) => boolean;
  _onStateChange: (flow: Flow, state: FlowState) => void;

  _loaded: boolean;
  load(
    src?: DataMap,
    funcId?: string,
    applyChange?: (data: DataMap) => boolean,
    onStateChange?: (flow: Flow, state: FlowState) => void,
    namespace?: string
  ): boolean {
    if (this._loaded) {
      throw new Error('can not load flow twice');
    }
    this._loading = true;
    let loaded = false;
    if (funcId) {
      // load from worker class
      const desc: FunctionDesc = Functions.getDescToSend(funcId)[0];
      if (desc) {
        const data = Functions.getWorkerData(funcId);
        if (data) {
          this._namespace = desc.ns;
          this._loadFrom = funcId;
          this._loadFlowData(data, funcId);
          loaded = true;
        }
      } else if (src) {
        const colonIndex = funcId.indexOf(':');
        if (colonIndex >= 0) {
          this._namespace = funcId.substring(0, colonIndex);
        } else {
          this._namespace = null;
        }
        this._loadFrom = funcId;
        this._loadFlowData(src, funcId);
        loaded = true;
      }
    } else {
      if (namespace) {
        this._namespace = namespace;
      } else {
        this._namespace = this._parent._flow._namespace;
      }

      this._loadFrom = null;
      if (src) {
        this._loadFlowData(src);
        loaded = true;
      }
    }
    if (loaded) {
      this._applyChange = applyChange;
      this._onStateChange = onStateChange;
      this._loaded = true;
    }
    this._loading = false;
    return loaded;
  }
  // load data but not update applyChange or onStateChange
  loadData(data: DataMap) {
    this.load(data, null, this._applyChange, this._onStateChange);
  }

  _loadFlowData(map: DataMap, funcId?: string) {
    super._load(map);
    if (this._history) {
      this.destroyHistory();
      this._history = new FlowHistory(this, map);
      this.deleteValue('@has-change');
    }
  }

  startHistory() {
    if (!this._history) {
      this._history = new FlowHistory(this);
    }
  }

  destroyHistory() {
    if (this._history) {
      this._history.destroy();
      this._history = null;
    }
    this.deleteValue('@has-undo');
    this.deleteValue('@has-redo');
    this.deleteValue('@has-change');
  }

  trackChange() {
    if (this._applyChange) {
      if (this._history) {
        this._history.trackChange();
      } else {
        this.updateValue('@has-change', true);
      }
    }
  }

  undo() {
    this._history?.undo();
  }

  redo() {
    this._history?.redo();
  }

  watch(watcher: BlockChildWatch) {
    if (watcher.watchHistory) {
      this.startHistory();
    }
    super.watch(watcher);
  }

  unwatch(watcher: BlockChildWatch) {
    super.unwatch(watcher);

    if (this._history) {
      // check if history is still needed
      let needHistory = false;
      if (this._watchers) {
        for (const watcher of this._watchers) {
          if (watcher.watchHistory) {
            needHistory = true;
            break;
          }
        }
      }
      if (!needHistory) {
        this.destroyHistory();
        this.cancelChange();
      }
    }
  }

  applyChange() {
    if (this._applyChange) {
      if (this._history) {
        return this._applyChange(this._history.save());
      } else {
        const saved = this._applyChange(this.save());
        this.deleteValue('@has-change');
        return saved;
      }
    }
    return false;
  }

  cancelChange() {}

  liveUpdate(map: DataMap) {
    this._loading = true;
    this._liveUpdate(map);
    this._loading = false;
  }

  _applyFuncid(funcId: string) {
    // function must be fixed and only destroyed during destroy()
  }

  destroy(): void {
    if (this._history) {
      this._history.destroy();
      this._history = null;
    }

    this._onStateChange?.(this, FlowState.destroyed);
    super.destroy();
  }
}

export const FlowConstConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:const'),
};

class ConstBlock extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field in FlowConstConfigGenerators) {
      return new FlowConstConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}

class GlobalBlock extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field === '#timezone') {
      return new BlockConstConfig(this, '#timezone', getDefaultZone());
    }
    if (field in GlobalConfigGenerators) {
      return new GlobalConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
  createContextProperty(name: string): BlockProperty {
    // inside the GlobalBlock, context Property is normal property
    const prop = new BlockIO(this, name);
    this._props.set(name, prop);
    return prop;
  }
}

export class FlowFolder extends Flow {
  _createConfig(field: string): BlockProperty {
    if (field in FlowFolderConfigGenerators) {
      return new FlowFolderConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}

export class Root extends FlowFolder {
  private static _instance: Root = (function () {
    const root = new Root();
    Namespace.setRootInstance(root);
    return root;
  })();
  static get instance() {
    return this._instance;
  }

  static run() {
    this._instance._run();
  }

  static callLater(callback: () => void) {
    Resolver.callLater(callback);
    Root.instance._resolver.schedule();
  }

  /**
   * resolve recursively
   */

  static runAll(maxRound = 10) {
    this._instance.runAll(maxRound);
  }

  _resolver: Resolver;
  _storage: FlowStorage;

  queueBlock(block: Runnable) {
    this._resolver.queueBlock(block);
  }

  async setStorage(storage: FlowStorage) {
    Functions.setStorage(storage);
    this._storage = storage;
    await storage.init(this);
  }

  _run = () => {
    this._resolver.run();
    this._resolver._queued = false;
    Event._uid.next();
    Resolver._executeFinalResolved();
  };

  runAll(maxRound = 10) {
    for (let i = 0; i < maxRound; ++i) {
      if (this._resolver._queued) {
        this._run();
      } else {
        break;
      }
    }
  }

  _globalRoot: Flow;
  _sharedRoot: Flow;
  _tempRoot: Flow;

  constructor() {
    super(null);
    this._parent = this;
    this._resolver = new Resolver((resolver: Resolver) => {
      resolver._queued = true;
      resolver._queueToRun = true;
      setTimeout(this._run, 0);
    });

    // create the readolny global block
    this._globalRoot = this._createConstBlock('#global', (prop) => new GlobalBlock(this, this, prop, '#global'))._value;
    // this._globalRoot.load({'#settings': {'#is': '#flow:settings'}});
    this._tempRoot = this._createConstBlock('#temp', (prop) => new ConstBlock(this, this._globalRoot, prop))._value;
    this._sharedRoot = this._createConstBlock('#shared', (prop) => new ConstBlock(this, this._globalRoot, prop))._value;

    this._props.set('', new BlockConstConfig(this, '', this));
  }

  loadGlobal(data: DataMap, applyChange?: (data: DataMap) => boolean) {
    // preload the global settings before loading anything else
    updateGlobalSettings(new DataWrapper(data));
    this._globalRoot.load(data, null, applyChange);
  }

  createContextProperty(name: string): BlockProperty {
    return this.getContextProperty(name);
  }

  getContextProperty(name: string): BlockProperty {
    return this._globalRoot.getProperty(name);
  }

  addFlowFolder(path: string, loader?: FlowLoader, autoCreateFolder?: boolean): FlowFolder {
    let prop = this.queryProperty(path, true);
    if (!prop && autoCreateFolder) {
      // get the prop again
      this.addFlowFolder(path.substring(0, path.lastIndexOf('.')), loader);
      prop = this.queryProperty(path, true);
    }
    if (!prop || prop._value instanceof Block) {
      // invalid path
      return null;
    }
    if (!(prop._block instanceof FlowFolder)) {
      // can't create flow under a block or regular flow
      return null;
    }

    let newGroup: Flow;
    if (loader?.createFolder) {
      newGroup = loader.createFolder(path, prop);
    } else {
      newGroup = new FlowFolder(prop._block, null, prop);
    }
    prop.setValue(newGroup);
    if (prop._block === this) {
      // root folder automatically has the namespace with its name.
      newGroup._namespace = prop._name;
    } else {
      newGroup._namespace = prop._block._flow._namespace;
    }
    return newGroup;
  }

  addFlow(path?: string, data?: DataMap, loader?: FlowLoader, autoCreateFolder?: boolean): Flow {
    if (!path) {
      path = Block.nextUid();
    }
    let prop = this.queryProperty(path, true);
    if (!prop && autoCreateFolder) {
      // get the prop again
      this.addFlowFolder(path.substring(0, path.lastIndexOf('.')), loader, autoCreateFolder);
      prop = this.queryProperty(path, true);
    }
    if (!prop || prop._value instanceof Block) {
      // invalid path
      return null;
    }
    if (!(prop._block instanceof FlowFolder)) {
      // can't create flow under a block or regular flow
      return null;
    }

    if (!loader && this._storage) {
      loader = this._storage.getFlowLoader(path, prop);
    }
    let newFlow: Flow;
    if (loader?.createFlow) {
      newFlow = loader.createFlow(path, prop);
    } else {
      newFlow = new Flow(prop._block, null, prop);
    }

    const propValue = prop._value;
    if (Array.isArray(propValue) && propValue.length === 3 && propValue.every((val) => typeof val === 'number')) {
      // overwrite @b-xyw value from parent flow
      data = {...data, '@b-xyw': propValue};
    }
    if (loader) {
      if (!data) {
        data = {};
      }
      newFlow.load(data, null, loader.applyChange, loader.onStateChange);
      if (this._storage?.inited && Object.keys(data).length) {
        newFlow.applyChange();
      }
    } else {
      newFlow.load(data);
    }
    prop.setValue(newFlow);
    return newFlow;
  }

  deleteFlow(path: string) {
    const prop = this.queryProperty(path, false);
    if (prop?._value instanceof Flow) {
      if (this._storage) {
        this._storage.delete(path);
      }
      prop.setValue(undefined);
    }
  }

  save(): DataMap {
    // not allowed
    return null;
  }

  load(map: DataMap, funcId?: string, applyChange?: (data: DataMap) => boolean) {
    // not allowed
    return false;
  }

  liveUpdate(map: DataMap) {
    // not allowed
  }
}
