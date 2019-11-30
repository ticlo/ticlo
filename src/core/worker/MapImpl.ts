import {BlockFunction, FunctionData, FunctionOutput} from '../block/BlockFunction';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {Block, Job} from '../block/Block';
import {ThreadPool, UnlimitedPool, WorkerPool} from './ThreadPool';
import {voidFunction} from '../util/Functions';
import {Task} from '../block/Task';

export type MapWorkerMode = undefined | 'reuse' | 'persist';

export abstract class MapImpl extends BlockFunction {
  _src: DataMap | string;
  _srcChanged: boolean; /* = false*/

  _onSourceChange(val: any): boolean {
    if (typeof val === 'string' || isSavedBlock(val)) {
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
  _applyWorkerChange = (data: DataMap) => {
    this._data.setValue('use', data);
    return true;
  };

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
    if (!(n > 0)) {
      n = 0;
    }
    if (n === this._timeout) {
      return false;
    }
    this._timeoutChanged = true;
    this._timeout = n;
    return true;
  }

  _updateWorkerTimeout(seconds: number) {
    if (this._workers) {
      for (let [key, worker] of this._workers) {
        (worker._outputObj as WorkerOutput).updateTimeOut(seconds);
      }
    }
  }

  _pool: WorkerPool = new UnlimitedPool(
    (n: number) => this._removeWorker(n.toString()),
    () => this.queue()
  );

  _onThreadChanged(val: any): boolean {
    let n = Number(val);
    if (!(n >= 1)) {
      if (this._pool.constructor !== UnlimitedPool) {
        this._srcChanged = true;
        this._pool.clear();
        this._pool = new UnlimitedPool(
          (n: number) => this._removeWorker(n.toString()),
          () => this.queue()
        );
        return true;
      }
    } else {
      if (this._pool.constructor !== ThreadPool) {
        this._srcChanged = true;
        this._pool.clear();
        this._pool = new ThreadPool(
          n,
          (n: number) => this._removeWorker(n.toString()),
          () => this.queue()
        );
        return true;
      } else {
        return (this._pool as ThreadPool).resize(n);
      }
    }
    return false;
  }

  _funcBlock: Block;
  _workers?: Map<string | number, Job>;
  _waitingWorker = 0;

  abstract _onWorkerReady(output: WorkerOutput, timeout: boolean): void;

  _addWorker(key: string, field: string | number, input: any): Job {
    let output = new WorkerOutput(key, field, this._timeout, (output: WorkerOutput, timeout: boolean) =>
      this._onWorkerReady(output, timeout)
    );
    let child = this._funcBlock.createOutputJob(key, this._src, output, this._applyWorkerChange);
    child.onResolved = () => {
      if (!child._waiting) {
        output.workerReady();
      }
    };
    this._workers.set(key, child);
    child.updateInput(input);
    return child;
  }

  _removeWorker(key: string | number) {
    let worker = this._workers.get(key);
    if (worker) {
      (worker._outputObj as WorkerOutput).cancel();
      this._funcBlock.deleteValue(key.toString());
      this._workers.delete(key);
    }
  }

  _clearWorkers() {
    if (this._workers) {
      for (let [key, worker] of this._workers) {
        this._removeWorker(key);
      }
      this._workers = null;
      this._waitingWorker = 0;
      this._timeoutChanged = false;
      this._pool.clear();
    }
  }
}

export class WorkerOutput implements FunctionOutput {
  // name of the worker
  key: string | number;
  // name of the property in the input and the output object
  field: string | number;

  timeout: any;
  onReady: (output: WorkerOutput, timeout: boolean) => void;

  task: Task;

  constructor(
    key: string | number,
    field: string | number,
    timeoutSeconds: number,
    onReady: (output: WorkerOutput, timeout: boolean) => void
  ) {
    this.key = key;
    this.field = field;
    if (field !== undefined) {
      this.onReady = onReady;
      if (timeoutSeconds > 0) {
        this.timeout = setTimeout(this.onTimeout, timeoutSeconds * 1000);
      }
    }
  }

  updateTimeOut(seconds: number) {
    if (this.onReady) {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      if (seconds > 0) {
        this.timeout = setTimeout(this.onTimeout, seconds * 1000);
      }
    }
  }

  onTimeout = () => {
    if (this.onReady) {
      let onReady = this.onReady;
      this.onReady = null;
      onReady(this, true);
    }
  };

  output(value: any, field?: string): void {
    // do nothing
  }

  workerReady(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.onReady) {
      let onReady = this.onReady;
      this.onReady = null;
      onReady(this, false);
    }
  }

  // reuse the output on a new Render
  reset(
    field: string | number,
    timeoutSeconds: number,
    onReady: (output: WorkerOutput, timeout: boolean) => void,
    task?: Task
  ) {
    this.field = field;
    this.onReady = onReady;
    this.updateTimeOut(timeoutSeconds);
    this.task = task;
  }

  cancel() {
    this.onReady = null;
  }
}
