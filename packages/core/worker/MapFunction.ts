import {Functions} from '../block/Functions.js';
import {Block} from '../block/Block.js';
import {convertToOutput} from '../util/DataTypes.js';
import {ErrorEvent, Event, EventType, WAIT} from '../block/Event.js';
import {MapImpl, WorkerOutput} from './MapImpl.js';
import {BlockProxy} from '../block/BlockProxy.js';
import {UnlimitedPool} from './ThreadPool.js';
import {RepeaterWorker} from './WorkerFlow.js';
import {defaultConfigs} from '../block/Descriptor.js';
import {WorkerControl} from './WorkerControl.js';

interface KeyIterator {
  current(): string;
  next(): boolean;
  hasCustom(): boolean;
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

  hasCustom() {
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
  hasCustom() {
    return this._current < this._size;
  }
}

export class MapFunction extends MapImpl {
  _input: any;
  _pendingInput: any;
  _output: any;

  _pendingKeys?: KeyIterator;

  _running = false;

  static inputMap = new Map([
    ['input', MapFunction.prototype._onInputChange],
    ['use', WorkerControl.onUseChange],
    ['thread', MapFunction.prototype._onThreadChanged],
    ['reuseWorker', MapFunction.prototype._onReuseWorkerChange],
    ['timeout', MapFunction.prototype._onTimeoutChange],
  ]);
  getInputMap() {
    return MapFunction.inputMap;
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
    if (this._assignWorker() && this._waitingWorker === 0) {
      this._data.output(this._output);
      this._input = undefined;
    }
  }

  run(): any {
    if (this.control._srcChanged) {
      this._clearWorkers();
      this.control._srcChanged = false;
      if (!this._pendingInput) {
        // when source changed, redo the mapping on current input
        this._onInputChange(this._data.getValue('input'));
      }
    } else if (this._timeoutChanged) {
      this._updateWorkerTimeout(this._timeout);
    }

    // clear running workers update on sync run

    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#flows');
    }

    if (!this.control.isReady()) {
      return WAIT;
    }

    if (this._input) {
      if (!this._assignWorker()) {
        // _assignWorker returns false means there are still pendingKeys
        return WAIT;
      }
      if (this._waitingWorker > 0) {
        // all pending keys are assigned to workers but still waiting for some worker
        return WAIT;
      }
      // everything is done, finish the current one and move to next
      this._data.output(this._output);
      this._input = undefined;
    }

    if (!this._pendingInput) {
      if (this._reuseWorker !== 'persist') {
        this._clearWorkers();
      }
      // return ready state
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

    return WAIT;
  }

  _onWorkerReady(output: WorkerOutput, timeout: boolean) {
    if (timeout) {
      this._output[output.field] = new ErrorEvent('timeout');
    } else {
      this._output[output.field] = convertToOutput(this._workers.get(output.key).getValue('#outputs'));
    }
    this._waitingWorker--;
    this._pool.done(output.key, this._reuseWorker != null);
  }

  _updateWorkerInput(worker: RepeaterWorker) {
    ++this._waitingWorker;
    const key = this._pendingKeys.current();
    (worker._outputObj as WorkerOutput).reset(key, this._timeout, (output: WorkerOutput, timeout: boolean) =>
      this._onWorkerReady(output, timeout)
    );
    worker.updateInput(this._input[key]);
    this._pendingKeys.next();
  }

  // return true when all pending keys are assigned
  _assignWorker() {
    if (!this._workers) {
      this._workers = new Map();
    }
    if (this._pendingKeys) {
      while (this._pendingKeys.hasCustom()) {
        const threadId = this._pool.next(this._pendingKeys.current());
        if (threadId === null) {
          return false;
        }
        let worker = this._workers.get(threadId);
        if (!worker) {
          worker = this._addWorker(threadId, undefined, undefined);
        } else if ((worker._outputObj as WorkerOutput).onReady) {
          if (this._pool.constructor === UnlimitedPool) {
            // impossible territory
            (worker._outputObj as WorkerOutput).cancel();
            this._waitingWorker--;
          } else {
            // this worker is still in use, skip it
            continue;
          }
        }
        this._updateWorkerInput(worker);
      }
    }

    if (this._reuseWorker == null || (this._reuseWorker === 'reuse' && !this._pendingInput)) {
      // clear unused worker
      this._pool.clearPending();
    }
    return true;
  }

  _clearWorkers() {
    super._clearWorkers();

    this._pendingKeys = undefined;
    this._input = null;
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    if (this._input) {
      if (this._reuseWorker) {
        if (this._workers) {
          for (const [key, worker] of this._workers) {
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
        this._onInputChange(this._data.getValue('#inputs'));
      }
    }
    return true;
  }

  cleanup(): void {
    this._data.deleteValue('#output');
    this._data.deleteValue('#flows');
  }

  destroy(): void {
    this._clearWorkers();
    this._funcBlock = null;
    super.destroy();
  }
}

Functions.add(MapFunction, {
  name: 'map',
  priority: 3,
  configs: defaultConfigs.concat('#cancel'),
  properties: [
    {name: 'input', pinned: true, type: 'object'},
    {name: 'use', type: 'worker'},
    {name: 'thread', type: 'number', default: 0, min: 0, step: 1},
    {name: 'reuseWorker', type: 'radio-button', options: ['none', 'reuse', 'persist'], default: 'none'},
    {name: 'timeout', type: 'number'},
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  category: 'repeat',
});
