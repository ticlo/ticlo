import {Runnable} from "./Block";
import {Uid} from "../util/Uid";

export class Resolver implements Runnable {
  private static _uid = new Uid();
  static get uid(): string {
    return Resolver._uid.current;
  }

  // as Runnable
  _queued: boolean = false;
  _queueToRun: boolean = false;

  getPriority(): number {
    return 3;
  }

  private _queueWait: Runnable[] = [];

  private _queue: Runnable[][] = [[], [], [], []];


  // for both browser and node
  _loopScheduled: any;
  _resolving: boolean = false;

  private _schedule: (resolver: Resolver) => void;

  constructor(schedule: (resolver: Resolver) => void) {
    this._schedule = schedule;
  }

  queueBlock(block: Runnable) {
    if (block._queued) return;
    block._queued = true;
    block._queueToRun = true;
    this._queueWait.push(block);
    if (!(this._loopScheduled || this._resolving)) {
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
    if (this._loopScheduled) {
      this._loopScheduled = null;
      this._resolve();
    }
  }

  _resolve() {
    this._resolving = true;
    this._splitQueue(0);

    whileResolver: while (true) {
      let queue0 = this._queue[0];
      while (queue0.length) {
        let block = queue0[queue0.length - 1];
        if (block._queueToRun) {
          this._runBlock(block, 0);
        } else {
          queue0.pop();
          block._queued = false;
        }
      }
      for (let p = 1; p <= 3; ++p) {
        let queueP = this._queue[p];
        while (queueP.length) {
          let block = queueP[queueP.length - 1];
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

    Resolver._uid.next();

    this._resolving = false;
  }
}
