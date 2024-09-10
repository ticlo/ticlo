import {Block, BlockChildWatch, InputsBlock, Runnable} from './Block';
import {BlockConfig, BlockIO, BlockProperty, GlobalProperty} from './BlockProperty';
import {Resolver} from './Resolver';
import {BlockConstConfig, ConstTypeConfig, FlowConfigGenerators, FlowFolderConfigGenerators} from './BlockConfigs';
import {Event} from './Event';
import {DataMap} from '../util/DataTypes';
import {FunctionDesc} from './Descriptor';
import {Functions} from './Functions';
import {FlowStorage} from './Storage';
import {FlowHistory} from './FlowHistory';
import {GlobalConfigGenerators, SettingsBlock} from './SettingsBlock';
import {updateGlobalSettings} from '../util/Settings';
import {FunctionOutput} from './FunctonData';

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
    let newDisabled = this._parent._flow._disabled || Boolean(disabled);
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
    for (let [key, prop] of this._props) {
      let val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowDisabled();
      }
    }
  }

  _enabledBlock() {
    this._onStateChange?.(this, FlowState.enabled);
    for (let [key, prop] of this._props) {
      let val = prop._value;
      if (val instanceof Block && val._prop === prop) {
        val._flowEnabled();
      }
    }
  }

  createGlobalProperty(name: string): BlockProperty {
    let prop = new GlobalProperty(this, name);
    this._props.set(name, prop);
    return prop;
  }

  getGlobalProperty(name: string): BlockProperty {
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
    let prop = this.getProperty('#inputs');
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

  load(
    src: DataMap,
    funcId?: string,
    applyChange?: (data: DataMap) => boolean,
    onStateChange?: (flow: Flow, state: FlowState) => void
  ): boolean {
    this._loading = true;
    let loaded = false;
    if (funcId) {
      // load from worker class
      let desc: FunctionDesc = Functions.getDescToSend(funcId)[0];
      if (desc) {
        let data = Functions.getWorkerData(funcId);
        if (data) {
          this._namespace = desc.ns;
          this._loadFrom = funcId;
          this._loadFlowData(data, funcId);
          loaded = true;
        }
      } else if (src) {
        let colonIndex = funcId.indexOf(':');
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
      this._namespace = this._parent._flow._namespace;
      this._loadFrom = null;
      if (src) {
        this._loadFlowData(src);
        loaded = true;
      }
    }
    if (loaded) {
      this._applyChange = applyChange;
      this._onStateChange = onStateChange;
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
        for (let watcher of this._watchers) {
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
        let saved = this._applyChange(this.save());
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
    if (field in GlobalConfigGenerators) {
      return new GlobalConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
  createGlobalProperty(name: string): BlockProperty {
    // inside the GlobalBlock, globalProperty is normal property
    let prop = new BlockIO(this, name);
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
  private static _instance: Root = new Root();
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
    this._globalRoot.load({'#settings': {'#is': '#flow:settings'}});
    this._tempRoot = this._createConstBlock('#temp', (prop) => new ConstBlock(this, this._globalRoot, prop))._value;
    this._sharedRoot = this._createConstBlock('#shared', (prop) => new ConstBlock(this, this._globalRoot, prop))._value;

    this._props.set('', new BlockConstConfig(this, '', this));
  }

  loadGlobal(data: DataMap, applyChange?: (data: DataMap) => boolean) {
    const settingBlock = this._globalRoot.getValue('#settings') as SettingsBlock;
    settingBlock._preLoad(data['#settings']);
    updateGlobalSettings(settingBlock);
    this._globalRoot.load(data, null, applyChange);
  }

  createGlobalProperty(name: string): BlockProperty {
    return this.getGlobalProperty(name);
  }

  getGlobalProperty(name: string): BlockProperty {
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
    return newGroup;
  }

  addFlow(path?: string, data?: DataMap, loader?: FlowLoader, autoCreateFolder?: boolean): Flow {
    if (!path) {
      path = Block.nextUid();
    }
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

    if (!loader && this._storage) {
      loader = this._storage.getFlowLoader(path, prop);
    }
    let newFlow: Flow;
    if (loader?.createFlow) {
      newFlow = loader.createFlow(path, prop);
    } else {
      newFlow = new Flow(prop._block, null, prop);
    }

    let propValue = prop._value;
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
        this._storage.saveFlow(newFlow, data);
      }
    } else {
      if (data) {
        newFlow.load(data);
      }
    }
    prop.setValue(newFlow);
    return newFlow;
  }

  deleteFlow(path: string) {
    let prop = this.queryProperty(path, false);
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
