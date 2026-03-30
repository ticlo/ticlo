import {type Block} from '../block/Block.js';
import {DataMap, isDataMap, isSavedBlock} from '../util/DataTypes.js';
import {Flow, Root} from '../block/Flow.js';
import {StreamDispatcher} from '../block/Dispatcher.js';
import {BaseFunction, FunctionClass, StatefulFunction} from '../block/BlockFunction.js';
import {getBlockStoragePath} from '../util/Path.js';
import {WorkerFunctionGen} from './WorkerFunctionGen.js';
import {FunctionDispatcher} from '../block/FunctionGroup.js';
import {Namespace} from '../block/Namespace.js';

export interface WorkerHost {
  get control(): WorkerControl;
  get workerField(): string;
}

type WorkerHostFunction = WorkerHost & BaseFunction<Block>;

export class WorkerControl {
  // register this function in
  static onUseChange(this: StatefulFunction, val: unknown) {
    return (this as unknown as WorkerHostFunction).control.onUseChange(val);
  }
  constructor(
    public readonly func: WorkerHostFunction,
    public readonly block: Block
  ) {}

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
    if (typeof this._src === 'string' && this._src !== '') {
      const functionGroup = Namespace.getFunctions(this._src, this.block._flow);
      if (functionGroup) {
        this._funcSrc = functionGroup.listen(this._src, this);
      }
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
    return this._src != null;
  }

  saveInline = (flow: Flow) => {
    const data = flow.save();
    this.block.setValue(this.func.workerField, data);
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

  destroy() {
    if (this._funcSrc) {
      this._funcSrc.unlisten(this);
    }
  }
}
