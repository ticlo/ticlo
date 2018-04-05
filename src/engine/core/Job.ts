import {Block} from "./Block";
import {BlockProperty} from "./BlockProperty";
import {Loop} from "./Loop";

export class Job extends Block {

  private _queueWait: Block[] = [];
  private _enabled = true;

  set enabled(val: boolean) {
    if (this._enabled === val) return;
    this._enabled = val;
    if (this._enabled && this._queueWait.length) {
      for (let block of this._queueWait) {
        Loop.queueJob(block);
      }
      // clear the queue
      this._queueWait.length = 0;
    }
  }

  constructor() {
    super(null, null);

    this._job = this;
    this._prop = new BlockProperty(this, '');
  }

  queueBlock(block: Block) {
    if (block._queued) return;
    block._queued = true;
    if (this._enabled) {
      Loop.queueJob(block);
    } else {
      this._queueWait.push(block);
    }
  }

  // event loop


}