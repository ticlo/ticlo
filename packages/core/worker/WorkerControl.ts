import {type Block} from '../block/Block.ts';
import {DataMap, isDataMap, isSavedBlock} from '../util/DataTypes.ts';
import {Flow, Root} from '../block/Flow.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';
import {BaseFunction, FunctionFactory, StatefulFunction} from '../block/BlockFunction.ts';
import {WorkerFunctionGen} from './WorkerFunctionGen.ts';
import {FunctionDispatcher, type FunctionListenMode} from '../block/FunctionModule.ts';
import {Library} from '../block/Library.ts';
import {EventType} from '../block/Event.ts';

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
    public readonly block: Block,
    private readonly _multiInstance = false
  ) {}

  _src: DataMap | string;
  _srcChanged: boolean; /* = false*/
  _funcSrc: FunctionDispatcher;

  // When use field is changed
  onUseChange(val: any): boolean {
    if (this._src) {
      this.block.deleteValue('#static');
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
    this.available = false;
    if (typeof this._src === 'string' && this._src !== '') {
      // String worker sources are live function references. Keep listening to
      // their FunctionDispatcher so workers are rebuilt when the definition changes.
      const functionModule = Library.getFunctions(this._src, this.block._flow);
      if (functionModule) {
        const mode: FunctionListenMode = this._multiInstance ? 'multi' : 'single';
        this._funcSrc = functionModule.listen(this._src, this, mode);
      }
    }
    return true;
  }
  private available = false;
  // When registered function is changed
  onChange(value: FunctionFactory | null) {
    if (!value && this.available) {
      // Cancel work immediately; the resolver will rebuild an empty worker.
      this.block._cancelFunction(EventType.TRIGGER);
      this.block.deleteValue('#worker');
      this.block.output(undefined);
    }
    this.available = Boolean(value);
    this._srcChanged = true;
    this.block._queueFunction();
  }
  // When subflow is changed
  onLoad = (val: DataMap) => {
    this._srcChanged = true;
    this.block._queueFunction();
  };
  isReady() {
    if (typeof this._src === 'string') {
      return this._src === '' || this.available;
    }
    return this._src != null;
  }

  getWorkerData(): DataMap | null {
    if (isDataMap(this._src)) {
      return this._src;
    }
    if (typeof this._src === 'string') {
      return this._funcSrc?.getValue()?.ticlWorkerData ?? null;
    }
    return null;
  }

  saveInline = (flow: Flow) => {
    const data = flow.save();
    this.block.setValue(this.func.workerField, data);
    return data;
  };

  getSaveParameter(): {src?: string | DataMap; saveCallback?: Flow['_applyChange']} {
    const src: string | DataMap = this._src;
    if (typeof src === 'string') {
      // Editing a referenced worker writes back into the function registry.
      return {
        src,
        saveCallback: (flow: Flow) => {
          return WorkerFunctionGen.applyChangeToFunc(flow, src);
        },
      };
    }
    if (isDataMap(src)) {
      // Editing inline worker data writes the new flow JSON back to the host block.
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
