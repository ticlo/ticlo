import { Block } from "./Block";
import { BlockProperty } from "./BlockProperty";
import { Loop } from "./Loop";


export class Job extends Block {

  _enabled: boolean = true;

  constructor() {
    super(null, null, null);
    this._job = Root.instance;
    this._parent = Root.instance;

    this._prop = new BlockProperty(this, '');
  }


}

export class Root extends Job {

  static readonly instance: Root = new Root();

  constructor() {
    super();
    this._job = this;
    this._parent = this;
    this._loop = Loop._instance;
  }
}

