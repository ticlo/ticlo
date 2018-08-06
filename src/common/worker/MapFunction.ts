import {Classes} from "../block/Class";
import {BlockFunction, FunctionData, FunctionOutput} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO, BlockProperty} from "../block/BlockProperty";
import {Block, BlockChildWatch, BlockMode} from "../block/Block";
import {Job} from "../block/Block";
import {convertToObject, DataMap, isSavedBlock} from "../util/Types";
import {OutputFunction} from "./Output";
import {ErrorEvent, Event, EventType} from "../block/Event";
import {MapImpl, MapWorkerMode} from "./MapImpl";
import {BlockProxy} from "../block/BlockProxy";
import {workers} from "cluster";

enum ThreadTarget {
  None = 0,
  Array = 1,
  Object
}

class MapWorkerOutput implements FunctionOutput {
  // name of the worker
  key: string;
  // name of the property in the input and the output object
  field: string;

  _timeout: any;
  _onReady: (output: MapWorkerOutput, timeout: boolean) => void;

  constructor(key: string, field: string, timeoutSeconds: number,
              onReady: (output: MapWorkerOutput, timeout: boolean) => void) {
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
  reset(field: string, timeoutSeconds: number, onReady: (output: MapWorkerOutput, timeout: boolean) => void) {
    this.field = field;
    this._onReady = onReady;
    this.updateTimeOut(timeoutSeconds);
  }

  cancel() {
    this._onReady = null;
  }
}

export class MapFunction extends BlockFunction implements MapImpl {

  _src: DataMap;
  _srcChanged = false;
  _onSourceChange!: (val: any) => boolean;

  _input: any;
  _pendingInput: any;
  _output: any;
  _waitingWorker: number = 0;

  _funcBlock: Block;

  _thread = 0;
  // true for Array input, false for Object input
  _threadTarget: ThreadTarget = ThreadTarget.None;

  _reuseWorker: MapWorkerMode;
  _onReuseWorkerChange!: (val: any) => boolean;

  _timeout = 0;
  _timeoutChanged = false;
  _onTimeoutChange!: (val: any) => boolean;

  _workers?: {[key: string]: Job};
  // object worker that's not created yet
  _pendingKeys?: string[];
  // Array worker that's not created yet
  _pendingIdx: number = Infinity;

  _running = false;


  inputChanged(input: BlockIO, val: any): boolean {
    switch (input._name) {
      case 'input': {
        return this._onInputChange(input._value);
      }
      case 'src': {
        return this._onSourceChange(input._value);
      }
      case 'thread': {
        return this._onThreadChanged(input._value);
      }
      case 'reuseWorker': {
        return this._onReuseWorkerChange(input._value);
      }
      case 'timeout': {
        return this._onTimeoutChange(input._value);
      }
      // case 'keepOrder': {
      // }
    }
    return false;
  }

  _onInputChange(val: any): boolean {
    if (!Object.isExtensible(val)) {
      // validate the input
      val = null;
    }
    if (val) {
      this._pendingInput = val;
      // if current mapping is running, do not run and wait for it to finish
      return !this._input;
    } else {
      if (this._pendingInput) {
        this._pendingInput = null;
      }
      return false;
    }
  }

  _onThreadChanged(val: any): boolean {
    let n = Number(val);
    if (!(n >= 0)) {
      n = 0;
    }
    if (n === this._thread) {
      return false;
    }
    if ((this._thread > 0) as any ^ (n > 0) as any) {
      // thread mode changed
      this._srcChanged = true;
    }
    this._thread = n;
    return true;
  }

  run(): any {
    if (this._srcChanged) {
      this._clearWorkers();
      this._srcChanged = false;
      if (!this._pendingInput) {
        // when source changed, redo the mapping on current input
        this._onInputChange(this._data.getValue('#input'));
      }
    } else if (this._timeoutChanged) {
      this._updateWorkerTimeout(this._timeout);
    }

    // clear running workers update on sync run

    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#func');
    }

    // check if there are pending threads
    if (this._threadTarget) {
      if (this._threadTarget === ThreadTarget.Array) {
        if (this._pendingIdx < this._input.length) {
          this._runThread();
          return;
        }
      } else {
        if (this._pendingKeys.length > 0) {
          this._runThread();
          return;
        }
      }
      if (this._waitingWorker === 0) {
        this._data.output(this._output);
        this._input = undefined;
        // don't return, allow it to continue working on next pendingInput
      } else {
        // there are still waiting worker, dont run
        return;
      }
    } else if (this._waitingWorker > 0) {
      return;
    }


    if (!this._pendingInput) {
      if (this._reuseWorker !== 'persist') {
        this._clearWorkers();
      }
      // nothing to run
      return;
    } else if (!this._reuseWorker) {
      this._clearWorkers();
    }

    this._data.wait(true);

    this._input = this._pendingInput;
    if (this._input instanceof Block) {
      this._input = new Proxy(this._input, BlockProxy);
    }
    this._pendingInput = undefined;


    if (this._thread > 0) {
      if (Array.isArray(this._input)) {
        this._pendingIdx = 0;
        this._output = [];
        this._threadTarget = ThreadTarget.Array;
        this._runThread();
        return;
      } else {
        this._pendingKeys = Object.keys(this._input);
        this._output = {};
        this._threadTarget = ThreadTarget.Object;
        this._runThread();
        return;
      }
    } else {
      this._threadTarget = ThreadTarget.None;
      if (Array.isArray(this._input)) {
        this._output = [];
      } else {
        this._output = {};
      }
      this._watchObject(this._input);
    }
  }

  _onWorkerReady = (output: MapWorkerOutput, timeout: boolean) => {
    if (timeout) {
      this._output[output.field] = new ErrorEvent('timeout');
    } else {
      this._output[output.field] = convertToObject(this._workers[output.key].getValue('#output'));
    }
    this._waitingWorker--;
    if (this._threadTarget) {
      if (!this._reuseWorker || output.key as any >= this._thread) {
        // remove thread worker if the idx is more than max allowed thread
        this._removeWorker(output.key);
      }
      // let run() handler thread worker operation
      this._data._queueFunction();
    } else {
      if (this._waitingWorker === 0) {
        this._data.output(this._output);
        this._input = undefined;
        if (!this._reuseWorker) {
          this._clearWorkers();
        }
      }
    }
  };

  // return true when there is no more input
  _updateWorkerInput(worker: Job): boolean {
    if (this._threadTarget === ThreadTarget.Array) {
      ++this._waitingWorker;
      (worker._outputObj as MapWorkerOutput).reset(`${this._pendingIdx}`, this._timeout, this._onWorkerReady);
      worker.updateInput(this._input[this._pendingIdx], true);
      this._pendingIdx++;
      return this._pendingIdx === (this._input as any[]).length;
    } else {
      let key = this._pendingKeys.pop();
      ++this._waitingWorker;
      (worker._outputObj as MapWorkerOutput).reset(key, this._timeout, this._onWorkerReady);
      worker.updateInput(this._input[key], true);
      return this._pendingKeys.length === 0;
    }
  }

  _updateWorkerTimeout(seconds: number) {
    if (this._workers) {
      for (let key in this._workers) {
        let worker = this._workers[key];
        if (worker) {
          (worker._outputObj as MapWorkerOutput).updateTimeOut(seconds);
        }
      }
    }
  }

  _runThread() {
    if (!this._workers) {
      this._workers = {};
    }
    let idx = 0;
    for (; idx < this._thread; ++idx) {
      let worker = this._workers[idx];
      if (!worker) {
        worker = this._addWorker(`${idx}`, undefined, undefined);
      }
      if (!(worker._outputObj as MapWorkerOutput)._onReady) {
        if (this._updateWorkerInput(worker)) {
          // no more input
          break;
        }
      }
    }
    // clear unused worker
    if (this._reuseWorker !== 'persist') {
      for (; idx < this._thread; ++idx) {
        let worker = this._workers[idx];
        if (worker && !(worker._outputObj as MapWorkerOutput)._onReady) {
          this._removeWorker(`${idx}`);
        }
      }
    }
  }

  // when input is regular Object
  _watchObject(obj: DataMap) {
    if (this._workers) {
      // update existing workers
      let oldWorkers = this._workers;
      this._workers = {};
      for (let key in obj) {
        let input = obj[key];
        if (input === undefined) {
          continue;
        }
        if (oldWorkers[key]) {
          let oldWorker = oldWorkers[key];
          ++this._waitingWorker;
          (oldWorker._outputObj as MapWorkerOutput).reset(key, this._timeout, this._onWorkerReady);
          oldWorker.updateInput(input, true);
          this._workers[key] = oldWorker;
          oldWorkers[key] = undefined;
        } else {
          ++this._waitingWorker;
          this._addWorker(key, key, input);
        }
      }
      if (this._reuseWorker !== 'persist') {
        for (let key in oldWorkers) {
          let oldWorker = oldWorkers[key];
          if (oldWorker) {
            oldWorker.destroy();
            this._funcBlock.deleteValue(key);
          }
        }
      }
    } else {
      this._workers = {};
      for (let key in obj) {
        ++this._waitingWorker;
        this._addWorker(key, key, obj[key]);
      }
    }
  }

  _addWorker(key: string, field: string, input: any): Job {
    let output = new MapWorkerOutput(key, field, this._timeout, this._onWorkerReady);
    let child = this._funcBlock.createOutputJob(key, this._src, output, this._data._job._namespace);
    child.onResolved = () => {
      if (!child._waiting) {
        output.workerReady();
      }
    };
    this._workers[key] = child;
    child.updateInput(input);
    return child;
  }

  _removeWorker(key: string) {
    let worker = this._workers[key];
    if (worker) {
      (worker._outputObj as MapWorkerOutput).cancel();
      this._funcBlock.deleteValue(key);
      this._workers[key] = undefined;
    }
  }

  _clearWorkers() {
    if (this._workers) {
      for (let key in this._workers) {
        this._removeWorker(key);
      }
      this._workers = null;
      this._waitingWorker = 0;
      this._timeoutChanged = false;
      this._pendingKeys = undefined;
      this._pendingIdx = Infinity;
      this._threadTarget = ThreadTarget.None;
      this._input = null;
    }
  }

  cancel(reason: EventType = EventType.TRIGGER): void {
    if (this._input) {
      if (this._reuseWorker) {
        if (this._workers) {
          for (let key in this._workers) {
            let worker = this._workers[key];
            if (worker) {
              worker.cancel();
              (worker._outputObj as MapWorkerOutput).cancel();
            }
          }
        }
        this._waitingWorker = 0;
        this._pendingKeys = undefined;
        this._pendingIdx = Infinity;
        this._threadTarget = ThreadTarget.None;
        this._input = null;
      } else {
        this._clearWorkers();
      }

      // TODO: what if block is queued, and not supposed to be run?
      if (!this._pendingInput) {
        // when source changed, redo the mapping on current input
        this._onInputChange(this._data.getValue('#input'));
      }
    }
  }

  destroy(): void {
    this._clearWorkers();
    this._funcBlock = null;
    super.destroy();
  }
}

// implements from MapImpl
MapFunction.prototype._onSourceChange = MapImpl.prototype._onSourceChange;
MapFunction.prototype._onReuseWorkerChange = MapImpl.prototype._onReuseWorkerChange;
MapFunction.prototype._onTimeoutChange = MapImpl.prototype._onTimeoutChange;

MapFunction.prototype.priority = 3;
Classes.add('map', MapFunction);
