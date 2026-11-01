import {Runnable} from './Block.ts';

export class Resolver implements Runnable {
  static _finalResolved: Set<() => void> = new Set<() => void>();
  static _executeFinalResolved() {
    for (const onResolved of Resolver._finalResolved) {
      onResolved();
    }
    Resolver._finalResolved.clear();
  }
  static callLater(f: () => void) {
    Resolver._finalResolved.add(f);
  }

  // as Runnable
  _queued: boolean = false;
  _queueToRun: boolean = false;

  getPriority(): number {
    return 3;
  }

  // REFACTOR(design.md): MUST replace the unbounded block wait list with a bounded delivery queue or backpressure.
  private _queueWait: Runnable[] = [];

  // queue has 4 priority groups
  // REFACTOR(design.md): MUST order deliveries by persisted wire order and source position, not queue group alone.
  private _queue: Runnable[][] = [[], [], [], []];

  _resolving: boolean = false;

  private _schedule: (resolver: Resolver) => void;

  constructor(schedule: (resolver: Resolver) => void) {
    this._schedule = schedule;
  }

  // REFACTOR(design.md): MUST admit each event deterministically and enforce the queue's capacity rule.
  queueBlock(block: Runnable) {
    if (block._queued) return;
    block._queued = true;
    block._queueToRun = true;
    this._queueWait.push(block);
    this.schedule();
  }

  /**
   * Make the _schedule() is called
   * This is usually only called by queueBlock
   * an exception is when _onResolved needs to be called even when no block is triggered
   */
  schedule() {
    if (!(this._queued || this._resolving)) {
      this._schedule(this);
    }
  }

  // // wait to be run
  // isWaiting(): boolean {
  //   return this._queueWait.length > 0;
  // }

  // return true when running priority need to change
  // REFACTOR(design.md): MUST preserve FIFO event order and tie-break by saved wire or block ID.
  private _splitQueue(priority: number) {
    let priorityChanged = false;
    for (let i = this._queueWait.length - 1; i >= 0; --i) {
      const block = this._queueWait[i];
      const blockPriority = block.getPriority();
      if (blockPriority >= 0 && blockPriority <= 3) {
        this._queue[blockPriority].push(block);
        if (priority > blockPriority) {
          priorityChanged = true;
        }
      } else {
        block._queued = false;
      }
    }
    // clear pending blocks
    this._queueWait.length = 0;

    return priorityChanged;
  }

  // return true when priority changed
  private _runBlock(block: Runnable, priority: number) {
    block.run();
    if (this._queueWait.length) {
      return this._splitQueue(priority);
    }
    return false;
  }

  run() {
    this._queueToRun = false;
    if (this._queued) {
      this._resolve();
    }
  }

  // REFACTOR(design.md): MUST process one delivery at a time; MUST append emissions to the queue tail.
  _resolve() {
    this._resolving = true;
    this._splitQueue(0);

    whileResolver: while (true) {
      const queue0 = this._queue[0];
      while (queue0.length) {
        const block = queue0[queue0.length - 1];
        if (block._queueToRun) {
          this._runBlock(block, 0);
        } else {
          queue0.pop();
          block._queued = false;
        }
      }
      // run blocks in priority order
      for (let p = 1; p <= 3; ++p) {
        const queueP = this._queue[p];
        while (queueP.length) {
          const block = queueP[queueP.length - 1];
          if (block._queueToRun) {
            if (this._runBlock(block, p)) {
              continue whileResolver;
            }
          } else {
            queueP.pop();
            block._queued = false;
          }
        }
      }
      break;
    }

    this._resolving = false;
  }
}
