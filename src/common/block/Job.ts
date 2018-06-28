import { Block } from "./Block";
import { BlockIO, BlockProperty } from "./BlockProperty";
import { Loop } from "./Loop";
import { FunctionOutput } from "./BlockFunction";


export class Job extends Block {

  _namespace: string;

  _enabled: boolean = true;
  _loading: boolean = false;

  _outputObj: FunctionOutput;

  constructor(parent: Block = Root.instance, output?: FunctionOutput, property?: BlockProperty, temp?: boolean) {
    super(null, null, property, temp);
    this._job = this;
    this._parent = parent;
    this._outputObj = output;
    if (!property) {
      this._prop = new BlockProperty(this, '');
    }
  }

  // return true when the related output block need to be put in queue
  outputChanged(input: BlockIO, val: any): boolean {
    if (this._outputObj) {
      this._outputObj.output(val, input._name);
    }
    return false;
  }


  save(): { [key: string]: any } {
    return this._save();
  }

  load(map: { [key: string]: any }) {
    this._loading = true;
    this._load(map);
    this._loading = false;
  }

  liveUpdate(map: { [key: string]: any }) {
    this._loading = true;
    this._liveUpdate(map);
    this._loading = false;
  }
}

export class Root extends Job {

  private static _instance: Root = new Root();
  static get instance() {
    return this._instance;
  }

  static run() {
    this._instance._loop._run();
  }

  _strictMode: boolean = (process.env.NODE_ENV || '').toLowerCase() === 'test';

  constructor() {
    super();
    this._parent = this;
    this._loop = new Loop((loop: Loop) => {
      loop._loopScheduled = setTimeout(() => loop._runSchedule(), 0);
    });
  }

  addJob(name?: string): Job {
    if (!name) {
      name = Block.nextUid();
    }
    let prop = this.getProperty(name);
    let newJob = new Job(this, null, prop);
    prop.setValue(newJob);
    return newJob;
  }

  save(): { [key: string]: any } {
    // not allowed
    return null;
  }

  load(map: { [key: string]: any }) {
    // not allowed
  }

  liveUpdate(map: { [key: string]: any }) {
    // not allowed
  }
}
