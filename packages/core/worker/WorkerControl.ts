import {type Block} from '../block/Block.js';
import {DataMap, isDataMap, isSavedBlock} from '../util/DataTypes.js';
import {Flow, Root} from '../block/Flow.js';
import {StreamDispatcher} from '../block/Dispatcher.js';
import {BaseFunction, FunctionClass, StatefulFunction} from '../block/BlockFunction.js';
import {getBlockStoragePath} from '../util/Path.js';
import {WorkerFunctionGen} from './WorkerFunctionGen.js';
import {FunctionDispatcher, globalFunctions} from '../block/FunctionGroup.js';

export interface WorkerHost {
  get control(): WorkerControl;
  get workerField(): string;
}

type WorkerHostFunction = WorkerHost & BaseFunction<Block>;

export class SubflowLoader extends StreamDispatcher<DataMap> {
  static readonly loaders = new Map<string, SubflowLoader>();
  static getLoader(path: string) {
    let loader = SubflowLoader.loaders.get(path);
    if (!loader) {
      loader = new SubflowLoader(path);
      SubflowLoader.loaders.set(path, loader);
    }
    return loader;
  }

  constructor(readonly path: string) {
    super();
    Root.instance._storage.loadFlow(this.path).then((data: DataMap) => {
      this.dispatch(data);
      return data;
    });
  }

  save(data: DataMap) {
    Root.instance._storage.saveFlow(null, data, this.path);
    this.dispatch(data);
  }
  delete() {
    Root.instance._storage.delete(this.path);
    this.dispatch(null);
  }
}

export class WorkerControl {
  // register this function in
  static onUseChange(this: StatefulFunction, val: unknown) {
    return (this as unknown as WorkerHostFunction).control.onUseChange(val);
  }
  loader: SubflowLoader;
  readonly storagePath: string;
  constructor(
    public readonly func: WorkerHostFunction,
    public readonly block: Block
  ) {
    this.storagePath = getBlockStoragePath(block);
  }

  _src: DataMap | string;
  _srcChanged: boolean; /* = false*/
  _funcSrc: FunctionDispatcher;

  // When use field is changed
  onUseChange(val: any): boolean {
    if (this._src) {
      this.block.deleteValue('#shared');
    }
    if (val === this._src) {
      return false;
    }
    if (typeof val === 'string' || isSavedBlock(val)) {
      this._src = val;
      this._srcChanged = true;
    } else if (this._src != null) {
      this._src = undefined;
      this._srcChanged = true;
    }
    if (this._funcSrc) {
      this._funcSrc.unlisten(this);
      this._funcSrc = null;
    }
    if (typeof this._src === 'string' && this._src !== '#') {
      this._funcSrc = globalFunctions.listen(this._src, this);
    }
    // # for stored worker
    if (val === '#') {
      this.loader = SubflowLoader.getLoader(this.storagePath);
      this.loader.listen(this.onLoad);
    } else if (this.loader) {
      this.loader.unlisten(this.onLoad);
      this.loader = null;
    }
    return true;
  }
  // When registered function is changed
  onChange(value: FunctionClass) {
    this._srcChanged = true;
    this.block._queueFunction();
  }
  // When subflow is changed
  onLoad = (val: DataMap) => {
    this._srcChanged = true;
    this.block._queueFunction();
  };
  isReady() {
    if (this._src === '#') {
      return this.loader.value != null;
    }
    return this._src != null;
  }

  saveInline = (flow: Flow) => {
    const data = flow.save();
    this.block.setValue(this.func.workerField, data);
    return data;
  };
  saveStorage = (flow: Flow) => {
    const data = flow.save();
    Root.instance._storage.saveFlow(null, data, this.storagePath);
    return data;
  };

  getSaveParameter(): {src?: string | DataMap; saveCallback?: (flow: Flow) => DataMap} {
    const src: string | DataMap = this._src;
    if (typeof src === 'string') {
      return {
        src,
        saveCallback: (flow: Flow) => {
          return WorkerFunctionGen.applyChangeToFunc(flow, src);
        },
      };
    }
    if (isDataMap(src)) {
      return {src, saveCallback: this.saveInline};
    }
    return {};
  }

  deleteStorage() {
    Root.instance._storage.delete(this.storagePath);
  }
  destroy() {
    if (this.loader) {
      this.loader.unlisten(this.onLoad);
    }
    if (this._funcSrc) {
      this._funcSrc.unlisten(this);
    }
  }
}
