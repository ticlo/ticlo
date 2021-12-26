import {MapImpl, WorkerOutput} from './MapImpl';
import {DataMap} from '../util/DataTypes';
import {Block, BlockMode} from '../block/Block';
import {Functions} from '../block/Functions';
import {Event, EventType, WAIT, NO_EMIT} from '../block/Event';
import Denque from 'denque';
import {InfiniteQueue} from '../util/InfiniteQueue';
import {DefaultTask, Task} from '../block/Task';
import {RepeaterWorker} from './WorkerFlow';

export class HandlerFunction extends MapImpl {
  _queue = new Denque<Task>();
  _outQueue = new InfiniteQueue<any>(); // use InfiniteQueue to maintain the order of output

  static inputMap = new Map([
    ['use', HandlerFunction.prototype._onSourceChange],
    ['thread', HandlerFunction.prototype._onThreadChanged],
    ['reuseWorker', HandlerFunction.prototype._onReuseWorkerChange],
    ['timeout', HandlerFunction.prototype._onTimeoutChange],
    ['keepOrder', HandlerFunction.prototype._onKeepOrderChange],
    ['maxQueueSize', HandlerFunction.prototype._onMaxQueueSizeChange],
  ]);
  getInputMap() {
    return HandlerFunction.inputMap;
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
    this._checkQueueSize();
    return true;
  }
  _checkQueueSize() {
    if (this._queue.length > this._maxQueueSize) {
      let countToRemove = this._queue.length - this._maxQueueSize;
      for (let i = 0; i < countToRemove; ++i) {
        let inputToRemove = this._queue.get(i).onCancel();
      }
      this._queue.remove(0, countToRemove);
    }
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

  _updateWorkerInput(worker: RepeaterWorker) {
    ++this._waitingWorker;
    let field: any;
    if (this._keepOrder) {
      field = this._outQueue.total;
      this._outQueue.newSlot();
    }
    let input = this._queue.shift();
    (worker._outputObj as WorkerOutput).reset(
      field,
      this._timeout,
      (output: WorkerOutput, timeout: boolean) => this._onWorkerReady(output, timeout),
      input
    );
    worker.updateInput(input);
  }

  _called: any[] = [];
  onCall(val: any): boolean {
    if (val instanceof Event) {
      // ignore event of previous block
      val = undefined;
    }
    if (val !== undefined) {
      this._called.push(val);
    }
    return true;
  }

  run(): any {
    if (this._keepOrderChanged) {
      this._keepOrderChanged = false;
      this._clearWorkers();
    }

    for (let val of this._called) {
      if (val instanceof Task) {
        if (val.attachHandler(this)) {
          this._queue.push(val);
        }
      } else {
        this._queue.push(new DefaultTask(val));
      }
    }
    this._called.length = 0;

    this._checkQueueSize();

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
        return WAIT;
      }
    }
    if (this._waitingWorker > 0) {
      // all pending keys are assigned to workers but still waiting for some worker
      return WAIT;
    }
    if (this._reuseWorker !== 'persist') {
      this._clearWorkers();
    }
    return NO_EMIT;
  }

  _onWorkerReady(output: WorkerOutput, timeout: boolean) {
    this._waitingWorker--;
    let result: any;

    if (timeout) {
      result = output.task.onTimeout();
    } else {
      let worker = this._workers.get(output.key);
      result = output.task.onResolve(worker, worker.getValue('#outputs'));
    }

    if (result === undefined) {
      // undefined means output is not ready, not allowed as result
      result = null;
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
    if (this._workers) {
      for (let [key, worker] of this._workers) {
        if ((worker._outputObj as WorkerOutput).onReady) {
          (worker._outputObj as WorkerOutput).task.onCancel();
        }
      }
    }
    for (let i = 0; i < this._queue.length; ++i) {
      this._queue.get(i).onCancel();
    }
    this._queue.clear();
    super._clearWorkers();
    this._outQueue.clear();
  }
  cancel(reason: EventType, mode: BlockMode): boolean {
    if (reason === EventType.TRIGGER) {
      // cancel only when #cancel is triggered
      this._clearWorkers();
      this._called.length = 0;
    }
    return true;
  }

  cleanup(): void {
    this._data.deleteValue('#func');
  }

  destroy(): void {
    this._clearWorkers();
    this._called.length = 0;
    this._funcBlock = null;

    super.destroy();
  }
}

function getDefaultWorker(block: Block, field: string, blockStack: Map<any, any>): DataMap {
  if (field === 'use') {
    if (blockStack.has(this)) {
      return null;
    }
    blockStack.set(this, true);
    // proxy the default work to the original block
    let fromProp = block.getProperty('#call', false)?._bindingSource?.getProperty();
    if (fromProp) {
      return fromProp._block.getDefaultWorker(fromProp._name, blockStack);
    }
  }
  return null;
}

Functions.add(
  HandlerFunction,
  {
    name: 'handler',
    icon: 'fas:grip-lines-vertical',
    priority: 3,
    mode: 'onChange',
    properties: [
      {name: 'use', type: 'worker'},
      {name: 'thread', type: 'number', default: 0, min: 0, step: 1},
      {name: 'reuseWorker', type: 'radio-button', options: ['none', 'reuse', 'persist'], default: 'none'},
      {name: 'timeout', type: 'number'},
      {name: 'keepOrder', type: 'toggle'},
      {name: 'maxQueueSize', type: 'number', default: 0, min: 0, step: 1},
      {name: 'queueSize', type: 'number', readonly: true},
    ],
    category: 'repeat',
  },
  null,
  {getDefaultWorker}
);
