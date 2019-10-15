import {BlockFunction, FunctionData, FunctionOutput} from '../block/BlockFunction';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {Block} from '../block/Block';

export type MapWorkerMode = undefined | 'reuse' | 'persist';

export class MapImpl extends BlockFunction {
  _src: DataMap;
  _srcChanged: boolean; /* = false*/

  _onSourceChange(val: any): boolean {
    // TODO allow string use for class name
    if (isSavedBlock(val)) {
      this._src = val;
      this._srcChanged = true;
      return true;
    }
    if (this._src) {
      this._src = undefined;
      this._srcChanged = true;
      return true;
    }
    return false;
  }

  _reuseWorker: MapWorkerMode;

  _onReuseWorkerChange(val: any): boolean {
    if (val !== 'reuse' && val !== 'persist') {
      val = undefined;
    }
    if (val !== this._reuseWorker) {
      this._reuseWorker = val;
      // reuseWorker change should be treated same as use change
      this._srcChanged = true;
      return true;
    }
    return false;
  }

  _timeout: number;
  _timeoutChanged: boolean;

  _onTimeoutChange(val: any): boolean {
    let n = Number(val);
    if (!(n >= 0)) {
      n = 0;
    }
    if (n === this._timeout) {
      return false;
    }
    this._timeoutChanged = true;
    this._timeout = n;
    return true;
  }
}

export class WorkerOutput implements FunctionOutput {
  // name of the worker
  key: string;
  // name of the property in the input and the output object
  field: string;

  _timeout: any;
  _onReady: (output: WorkerOutput, timeout: boolean) => void;

  constructor(
    key: string,
    field: string,
    timeoutSeconds: number,
    onReady: (output: WorkerOutput, timeout: boolean) => void
  ) {
    this.key = key;
    this.field = field;
    if (field !== undefined) {
      this._onReady = onReady;
      if (timeoutSeconds > 0) {
        this._timeout = setTimeout(this.onTimeout, timeoutSeconds * 1000);
      }
    }
  }

  updateTimeOut(seconds: number) {
    if (this._onReady) {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      if (seconds > 0) {
        this._timeout = setTimeout(this.onTimeout, seconds * 1000);
      }
    }
  }

  onTimeout = () => {
    if (this._onReady) {
      let onReady = this._onReady;
      this._onReady = null;
      onReady(this, true);
    }
  };

  output(value: any, field?: string): void {
    // do nothing
  }

  workerReady(): void {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    if (this._onReady) {
      let onReady = this._onReady;
      this._onReady = null;
      onReady(this, false);
    }
  }

  // reuse the output on a new Render
  reset(field: string, timeoutSeconds: number, onReady: (output: WorkerOutput, timeout: boolean) => void) {
    this.field = field;
    this._onReady = onReady;
    this.updateTimeOut(timeoutSeconds);
  }

  cancel() {
    this._onReady = null;
  }
}
