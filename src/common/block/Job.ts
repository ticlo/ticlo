import {Block, Runnable} from "./Block";
import {BlockIO, BlockProperty} from "./BlockProperty";
import {Resolver} from "./Resolver";
import {FunctionOutput} from "./BlockFunction";
import {Event} from "./Event";


export class Job extends Block {

  _resolver: Resolver;

  _namespace: string;

  _enabled: boolean = true;
  _loading: boolean = false;

  _outputObj?: FunctionOutput;

  constructor(parent: Block = Root.instance, output?: FunctionOutput, property?: BlockProperty) {
    super(null, null, property);
    this._job = this;
    this._parent = parent;
    this._outputObj = output;
    if (!property) {
      this._prop = new BlockProperty(this, '');
    }

    if (parent) {
      let parentJob = parent._job;
      this._resolver = new Resolver((resolver: Resolver) => {
        if (!this._queued) {
          if (this._runOnChange) {
            // put in queue, but _called is not set to true
            // only run the sub resolver, not the function
            parentJob.queueBlock(this._resolver);
          }
        }
      });
    }
  }

  queueBlock(block: Runnable) {
    this._resolver.queueBlock(block);
  }

  // return true when the related output block need to be put in queue
  outputChanged(input: BlockIO, val: any): boolean {
    if (this._outputObj) {
      this._outputObj.output(val, input._name);
    }
    return false;
  }

  // make sure the input triggers a change
  updateInput(val: any, forceUpdate: boolean = false) {
    let prop = this.getProperty('#input');
    if (forceUpdate && Object.is(val, prop._value)) {
      prop.updateValue(undefined);
    }
    prop.updateValue(val);
  }

  cancel() {
    this.getProperty('#cancel').updateValue(new Event('cancel'));
  }

  save(): {[key: string]: any} {
    return this._save();
  }

  load(map: {[key: string]: any}) {
    this._loading = true;
    this._load(map);
    this._loading = false;
  }

  liveUpdate(map: {[key: string]: any}) {
    this._loading = true;
    this._liveUpdate(map);
    this._loading = false;
  }

  set onResolved(func: () => void) {
    this._resolver.onResolved = func;
  }
}

export class Root extends Job {

  private static _instance: Root = new Root();
  static get instance() {
    return this._instance;
  }

  static run() {
    this._instance._resolver._resolve();
  }

  _strictMode: boolean = (process.env.NODE_ENV || '').toLowerCase() === 'test';

  constructor() {
    super();
    this._parent = this;
    this._resolver = new Resolver((resolver: Resolver) => {
      resolver._queued = true;
      resolver._queueToRun = true;
      setTimeout(() => {
        resolver.run();
        resolver._queued = false;
      }, 0);
    });
    this.onResolved = () => {
      Event._uid.next();
    };
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

  save(): {[key: string]: any} {
    // not allowed
    return null;
  }

  load(map: {[key: string]: any}) {
    // not allowed
  }

  liveUpdate(map: {[key: string]: any}) {
    // not allowed
  }
}
