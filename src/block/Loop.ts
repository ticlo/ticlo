import { Block } from "./Block";

export class Loop {
  private static _tick = 0;
  static get tick(): number {
    return this._tick;
  }

  private _queueWait: Block[] = [];

  private _queue: Block[][] = [[], [], [], []];


  // for both browser and node
  _loopScheduled: any;
  _loopRunning: boolean = false;

  private _schedule: (loop: Loop) => void;

  constructor(schedule: (loop: Loop) => void) {
    this._schedule = schedule;
  }

  queueBlock(block: Block) {
    if (block._queued) return;
    block._queued = true;
    block._queueDone = false;
    this._queueWait.push(block);
    if (!(this._loopScheduled || this._loopRunning)) {
      this._schedule(this);
    }
  }
  // wait to be run
  isWaiting(): boolean {
    return this._queueWait.length > 0;
  }

  // return true when running priority need to change
  private _splitQueue(priority: number) {
    let priorityChanged = false;
    for (let i = this._queueWait.length - 1; i >= 0; --i) {
      let block = this._queueWait[i];
      let blockPriority = block.getPriority();
      if (blockPriority >= 0 && blockPriority <= 3) {
        this._queue[blockPriority].push(block);
        if (priority > blockPriority) {
          priorityChanged = true;
        }
      } else {
        block._queueDone = true;
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

  _runSchedule() {
    if (this._loopScheduled) {
      this._loopScheduled = null;
      this._run();
    }
  }

  _run() {
    this._loopRunning = true;
    this._splitQueue(0);

    whileLoop: while (true) {
      let queue0 = this._queue[0];
      while (queue0.length) {
        let block = queue0[queue0.length - 1];
        if (block._queueDone) {
          queue0.pop();
          block._queued = false;
        } else {
          this._runBlock(block, 0);
        }
      }
      for (let p = 1; p <= 3; ++p) {
        let queueP = this._queue[p];
        while (queueP.length) {
          let block = queueP[queueP.length - 1];
          if (block._queueDone) {
            queueP.pop();
            block._queued = false;
          } else if (this._runBlock(block, 1)) {
            continue whileLoop;
          }
        }
      }
      break;
    }

    // almost unique id
    if (++Loop._tick === Number.MAX_SAFE_INTEGER) {
      Loop._tick = Number.MIN_SAFE_INTEGER;
    }
    this._loopRunning = false;
  }
}
