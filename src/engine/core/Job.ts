import { Block } from "./Block";
import { BlockProperty } from "./BlockProperty";
import { Loop } from "./Loop";


export class Job extends Block {

  _enabled: boolean = true;

  constructor() {
    super(null, null, null);
    this._job = this;
    this._parent = Root.instance;

    this._prop = new BlockProperty(this, '');
  }
}

export class Root extends Job {

  private static _instance: Root = new Root();
  static get instance() { return this._instance; }
  static run() {
    this._instance._loop._run();
  }

  constructor() {
    super();
    this._parent = this;
    this._loop = new Loop((loop: Loop) => {
      loop._loopScheduled = setTimeout(() => loop._runSchedule(), 0);
    });
  }
}
