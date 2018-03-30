import {Block} from "Block"
import {BlockProperty} from "BlockProperty"

export class Job extends Block {
  constructor() {
    super(null, null);

    this._job = this;
    this._prop = new BlockProperty(this, '');
  }
}
