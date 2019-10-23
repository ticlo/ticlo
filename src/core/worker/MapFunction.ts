import {Types} from '../block/Type';
import {BlockFunction, FunctionData, FunctionOutput} from '../block/BlockFunction';
import {FunctionDesc} from '../block/Descriptor';
import {BlockIO, BlockProperty} from '../block/BlockProperty';
import {Block, Job} from '../block/Block';
import {convertToObject, DataMap, isSavedBlock} from '../util/DataTypes';
import {ErrorEvent, Event, EventType, NOT_READY} from '../block/Event';
import {MapImpl, MapWorkerMode, WorkerOutput} from './MapImpl';
import {BlockProxy} from '../block/BlockProxy';

interface KeyIterator {
  current(): string;
  next(): boolean;
  hasNext(): boolean;
}

class ArryIterator implements KeyIterator {
  _array: string[];
  _idx = 0;

  constructor(array: string[]) {
    this._array = array;
  }

  current() {
    return this._array[this._idx];
  }

  next() {
    this._idx++;
    return this._idx < this._array.length;
  }

  hasNext() {
    return this._idx < this._array.length;
  }
}

class IndexIterator implements KeyIterator {
  _current = 0;
  _size: number;

  constructor(size: number) {
    this._size = size;
  }

  current() {
    return this._current.toString();
  }

  next() {
    this._current++;
    return this._current < this._size;
  }
  hasNext() {
    return this._current < this._size;
  }
}

export class MapFunction extends MapImpl {
  _input: any;
  _pendingInput: any;
  _output: any;

  _pendingKeys?: KeyIterator;

  _running = false;

  inputChanged(input: BlockIO, val: any): boolean {
    switch (input._name) {
      case 'input': {
        return this._onInputChange(input._value);
      }
      case 'use': {
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

  _startWithNewInput() {
    if (Array.isArray(this._input)) {
      this._pendingKeys = new IndexIterator(this._input.length);
      this._output = new Array(this._input.length);
    } else {
      this._pendingKeys = new ArryIterator(Object.keys(this._input));
      this._output = {};
    }
    this._runThread();
  }

  run(): any {
    if (this._srcChanged) {
      this._clearWorkers();
      this._srcChanged = false;
      if (!this._pendingInput) {
        // when source changed, redo the mapping on current input
        this._onInputChange(this._data.getValue('input'));
      }
    } else if (this._timeoutChanged) {
      this._updateWorkerTimeout(this._timeout);
    }

    // clear running workers update on sync run

    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#func');
    }

    if (this._input) {
      if (this._pendingKeys && this._pendingKeys.hasNext()) {
        this._runThread();
        return;
      } else if (this._waitingWorker > 0) {
        return;
      }
      this._data.output(this._output);
      this._input = undefined;
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

    this._input = this._pendingInput;
    if (this._input instanceof Block) {
      this._input = new Proxy(this._input, BlockProxy);
    }
    this._pendingInput = undefined;

    this._startWithNewInput();

    return NOT_READY;
  }

  _onWorkerReady = (output: WorkerOutput, timeout: boolean) => {
    if (timeout) {
      this._output[output.field] = new ErrorEvent('timeout');
    } else {
      this._output[output.field] = convertToObject(this._workers.get(output.key).getValue('#output'));
    }
    this._waitingWorker--;
    this._pool.done(output.key, this._reuseWorker != null);
  };

  // return true when there is no more input
  _updateWorkerInput(worker: Job): boolean {
    ++this._waitingWorker;
    let key = this._pendingKeys.current();
    (worker._outputObj as WorkerOutput).reset(key, this._timeout, this._onWorkerReady);
    worker.updateInput(this._input[key], true);
    // return true when no more pendingKeys
    return !this._pendingKeys.next();
  }

  _runThread() {
    if (!this._workers) {
      this._workers = new Map();
    }
    for (;;) {
      let threadId = this._pool.next(this._pendingKeys.current());
      if (threadId === null) {
        return;
      }
      let worker = this._workers.get(threadId);
      if (!worker) {
        worker = this._addWorker(threadId, undefined, undefined);
      }
      if (!(worker._outputObj as WorkerOutput)._onReady) {
        // reuse the worker
        if (this._updateWorkerInput(worker)) {
          // no more input
          break;
        }
      }
    }
    if (this._reuseWorker == null || (this._reuseWorker === 'reuse' && !this._pendingInput)) {
      // clear unused worker
      this._pool.clearPending();
    }
  }

  _addWorker(key: string, field: string, input: any): Job {
    let output = new WorkerOutput(key, field, this._timeout, this._onWorkerReady);
    let child = this._funcBlock.createOutputJob(key, this._src, output);
    child.onResolved = () => {
      if (!child._waiting) {
        output.workerReady();
      }
    };
    this._workers.set(key, child);
    child.updateInput(input);
    return child;
  }

  _clearWorkers() {
    super._clearWorkers();

    this._pendingKeys = undefined;
    this._pool.clear();
    this._input = null;
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    if (this._input) {
      if (this._reuseWorker) {
        if (this._workers) {
          for (let [key, worker] of this._workers) {
            if (worker) {
              worker.cancel();
              (worker._outputObj as WorkerOutput).cancel();
            }
          }
        }
        this._waitingWorker = 0;
        this._pendingKeys = undefined;
        this._pool.clear();
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
    return true;
  }

  destroy(): void {
    this._clearWorkers();
    this._funcBlock = null;
    super.destroy();
  }
}

MapFunction.prototype.priority = 3;
Types.add(MapFunction, {
  name: 'map',
  icon: 'fas:grip-vertical',
  priority: 1,
  style: 'repeater',
  properties: [
    {name: 'input', type: 'any'},
    {name: 'use', type: 'worker'},
    {name: 'thread', type: 'number'},
    {name: 'reuseWorker', type: 'toggle'},
    {name: 'timeout', type: 'number'},
    {name: 'output', type: 'any', readonly: true}
  ]
});
