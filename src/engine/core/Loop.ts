import {Block} from "./Block";

export class Loop {
  private static _tick = 0;
  static get tick(): number {
    return this._tick;
  }

  private _queueWait: Block[] = [];

  private _queue0: Block[] = [];
  private _queue1: Block[] = [];
  private _queue2: Block[] = [];

  private _loopTimeout = -1;

  private _schedule() {
    if (this._loopTimeout < 0) {
      this._loopTimeout = setTimeout(() => this._run(), 0);
    }
  }

  // manage the queue directly from loop
  _queue(block: Block) {
    if (block._queued) return;
    block._queued = true;
    this._queueWait.push(block);
    this._schedule();
  }

  // assume queue was initially managed by Job, so _queued must be true
  _addFromJob(block: Block) {
    if (!block._queued) return;
    this._queueWait.push(block);
    this._schedule();
  }

  private _splitQueue(priority: number) {
    let priorityChanged = false;
    for (let i = this._queueWait.length - 1; i >= 0; --i) {
      let block = this._queueWait[i];
      if (block._logic) {
        let priority = block._logic.priority;
        switch (priority) {
          case 0:
            this._queue0.push(block);
            block._queueDone = false;
            if (priority > 0) {
              priorityChanged = true;
            }
            break;
          case 1:
            this._queue1.push(block);
            block._queueDone = false;
            if (priority > 1) {
              priorityChanged = true;
            }
            break;
          case 2:
            this._queue2.push(block);
            block._queueDone = false;
            break;
        }
      }
    }
    // clear pending blocks
    this._queueWait.length = 0;

    return priorityChanged;
  }

  // return true when priority changed
  private _runBlock(block: Block, priority: number) {
    block.run();
    if (this._queueWait.length) {
      return this._splitQueue(priority);
    }
    return false;
  }

  private _run() {
    this._splitQueue(0);

    whileLoop: while (true) {
      while (this._queue0.length) {
        let block = this._queue0[this._queue0.length - 1];
        if (block._queueDone) {
          this._queue0.pop();
          block._queued = false;
        } else {
          this._runBlock(block, 0);
        }
      }

      while (this._queue1.length) {
        let block = this._queue1[this._queue1.length - 1];
        if (block._queueDone) {
          this._queue1.pop();
          block._queued = false;
        } else if (this._runBlock(block, 1)) {
          continue whileLoop;
        }
      }
      while (this._queue2.length) {
        let block = this._queue2[this._queue2.length - 1];
        if (block._queueDone) {
          this._queue2.pop();
          block._queued = false;
        } else if (this._runBlock(block, 2)) {
          continue whileLoop;
        }
      }
      break;
    }

    this._loopTimeout = -1;

    // almost unique id
    if (++Loop._tick === Number.MAX_SAFE_INTEGER) {
      Loop._tick = Number.MIN_SAFE_INTEGER;
    }
  }

  static _instance = new Loop();

  static queueJob(block: Block) {
    Loop._instance._addFromJob(block);
  }

  static run() {
    Loop._instance._run();
  }
}
