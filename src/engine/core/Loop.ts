import {Block} from "./Block";


export class Loop {

  private _tick: number = 0;
  get tick(): number {
    return this._tick;
  }

  private _pendingBlocks: Block[] = [];

  private _logicQueue0: Block[] = [];
  private _logicQueue1: Block[] = [];
  private _logicQueue2: Block[] = [];

  private _loopTimeout: number = -1;

  private _schedule() {
    if (this._loopTimeout < 0) {
      this._loopTimeout = setTimeout(() => this._run(), 0);
    }
  }

  add(block: Block) {
    if (block._queued) return;
    block._queued = true;
    this._pendingBlocks.push(block);
    this._schedule();
  }

  private _addBlocks(priority: number) {
    let priorityChanged = false;
    for (let i = this._pendingBlocks.length - 1; i >= 0; --i) {
      let block = this._pendingBlocks[i];
      if (block._logic) {
        let priority = block._logic.priority;
        switch (priority) {
          case 0:
            this._logicQueue0.push(block);
            block._queueDone = false;
            if (priority > 0) {
              priorityChanged = true;
            }
            break;
          case 1:
            this._logicQueue1.push(block);
            block._queueDone = false;
            if (priority > 1) {
              priorityChanged = true;
            }
            break;
          case 2:
            this._logicQueue2.push(block);
            block._queueDone = false;
            break;
        }
      }
    }
    // clear pending blocks
    this._pendingBlocks.length = 0;

    return priorityChanged;
  };

  // return true when priority changed
  private _runBlock(block: Block, priority: number) {
    block.run();
    if (this._pendingBlocks.length) {
      return this._addBlocks(priority);
    }
    return false;
  }

  private _run() {
    this._addBlocks(0);

    whileLoop:while (true) {
      while (this._logicQueue0.length) {
        let block = this._logicQueue0[this._logicQueue0.length - 1];
        if (block._queueDone) {
          this._logicQueue0.pop();
          block._queued = false;
        } else {
          this._runBlock(block, 0);
        }
      }

      while (this._logicQueue1.length) {
        let block = this._logicQueue1[this._logicQueue1.length - 1];
        if (block._queueDone) {
          this._logicQueue1.pop();
          block._queued = false;
        } else if (this._runBlock(block, 1)) {
          continue whileLoop;
        }
      }
      while (this._logicQueue2.length) {
        let block = this._logicQueue2[this._logicQueue2.length - 1];
        if (block._queueDone) {
          this._logicQueue2.pop();
          block._queued = false;
        } else if (this._runBlock(block, 2)) {
          continue whileLoop;
        }
      }
      break;
    }

    this._loopTimeout = -1;

    // a almost unique id
    if (++this._tick == Number.MAX_SAFE_INTEGER) {
      this._tick = Number.MIN_SAFE_INTEGER;
    }
  }
}