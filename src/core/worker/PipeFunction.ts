import {MapImpl, WorkerOutput} from './MapImpl';
import {convertToObject} from '../util/DataTypes';
import {BlockMode, Job} from '../block/Block';
import {Types} from '../block/Type';
import {CompleteEvent, ErrorEvent, EventType, NOT_READY} from '../block/Event';
import Denque from 'denque';
import {BlockIO} from '../block/BlockProperty';
import {InfiniteQueue} from '../util/InfiniteQueue';

export class PipeFunction extends MapImpl {
  _queue = new Denque<any>();
  _outQueue = new InfiniteQueue<any>();
  _currentInput: any;

  inputChanged(input: BlockIO, val: any): boolean {
    switch (input._name) {
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
      case 'keepOrder': {
        return this._onKeepOrderChange(input._value);
      }
      case 'maxQueueSize': {
        return this._onMaxQueueSizeChange(input._value);
      }
    }
    return false;
  }

  _keepOrder: boolean;
  _keepOrderChanged: boolean;

  _onKeepOrderChange(val: any): boolean {
    let keepOrder = Boolean(val);
    if (keepOrder === this._keepOrder) {
      return false;
    }
    this._keepOrderChanged = true;
    this._keepOrder = keepOrder;
    return true;
  }

  _maxQueueSize = Infinity;

  _onMaxQueueSizeChange(val: any): boolean {
    let n = Number(val);
    if (!(n >= 1)) {
      n = Infinity;
    }
    if (n === this._maxQueueSize) {
      return false;
    }
    this._maxQueueSize = n;
    if (this._queue.length > n) {
      this._queue.remove(0, this._queue.length - n);
    }
    return true;
  }

  // return true when everything in queue are assigned
  _assignWorker() {
    if (!this._workers) {
      this._workers = new Map();
    }
    while (!this._queue.isEmpty()) {
      let threadId = this._pool.next(null);
      if (threadId === null) {
        return false;
      }
      let worker = this._workers.get(threadId);
      if (!worker) {
        worker = this._addWorker(threadId, undefined, undefined);
      } else if ((worker._outputObj as WorkerOutput).onReady) {
        // this worker is still in use, skip it
        continue;
      }
      this._updateWorkerInput(worker);
    }

    if (this._reuseWorker !== 'persist') {
      // clear unused worker
      this._pool.clearPending();
    }
    return false;
  }

  _updateWorkerInput(worker: Job) {
    ++this._waitingWorker;
    let field: any;
    if (this._keepOrder) {
      field = this._outQueue.total;
      this._outQueue.newSlot();
    }
    let input = this._queue.shift();
    (worker._outputObj as WorkerOutput).reset(field, this._timeout, (output: WorkerOutput, timeout: boolean) =>
      this._onWorkerReady(output, timeout)
    );
    worker.updateInput(input);
  }

  run(): any {
    if (this._keepOrderChanged) {
      this._keepOrderChanged = false;
      this._clearWorkers();
    }
    let input = this._data.getValue('#call');
    if (input && input.constructor === CompleteEvent) {
      // ignore complete event of previous block
      input = undefined;
    }
    if (input !== this._currentInput) {
      if (input != null) {
        this._queue.push(input);
        if (this._queue.length > this._maxQueueSize) {
          this._queue.remove(0, this._queue.length - this._maxQueueSize);
        }
      }
      this._currentInput = input;
    }
    if (this._timeoutChanged) {
      this._updateWorkerTimeout(this._timeout);
    }

    // clear running workers update on sync run

    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#func');
    }

    if (!this._queue.isEmpty()) {
      if (this._assignWorker()) {
        // _assignWorker returns true means there are still pendingKeys
        return NOT_READY;
      }
    }
    if (this._waitingWorker > 0) {
      // all pending keys are assigned to workers but still waiting for some worker
      return NOT_READY;
    }
    if (this._reuseWorker !== 'persist') {
      this._clearWorkers();
    }
    // return ready state
    return;
  }

  _onWorkerReady(output: WorkerOutput, timeout: boolean) {
    this._waitingWorker--;
    let result: any;
    if (timeout) {
      result = new ErrorEvent('timeout');
    } else {
      result = convertToObject(this._workers.get(output.key).getValue('#output'));
      if (result === undefined) {
        // undefined means output is not ready, not allowed as result
        result = null;
      }
    }
    if (this._keepOrder) {
      this._outQueue.setAt(output.field as number, result);
      while (this._outQueue.peekFront() !== undefined) {
        let result = this._outQueue.shift();
        this._data.emitOnly(result);
      }
    } else {
      this._data.emitOnly(result);
    }
    this._pool.done(output.key, this._reuseWorker != null);
  }

  _clearWorkers() {
    super._clearWorkers();
    this._outQueue.clear();
  }
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto'): boolean {
    if (reason === EventType.TRIGGER) {
      // cancel only when #cancel is triggered
      this._clearWorkers();
    }
    return true;
  }

  destroy(): void {
    this._clearWorkers();
    this._queue.clear();
    this._funcBlock = null;
    super.destroy();
  }
}

PipeFunction.prototype.priority = 3;
Types.add(PipeFunction, {
  name: 'pipe',
  icon: 'fas:grip-lines-vertical',
  priority: 3,
  mode: 'onChange',
  style: 'repeater',
  properties: [
    {name: 'use', type: 'worker'},
    {name: 'thread', type: 'number', default: 0, min: 0, step: 1},
    {name: 'reuseWorker', type: 'radio-button', options: ['none', 'reuse', 'persist'], default: 'none'},
    {name: 'timeout', type: 'number'},
    {name: 'keepOrder', type: 'toggle'},
    {name: 'maxQueueSize', type: 'number', default: 0, min: 0, step: 1},
    {name: 'queueSize', type: 'number', readonly: true}
  ]
});
