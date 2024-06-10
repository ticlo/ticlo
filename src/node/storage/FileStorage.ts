import Fs from 'fs';
import Path from 'path';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '../../../src/core';
import {WorkerFunction} from '../../../src/core/worker/WorkerFunction';
import {FlowLoader, FlowState} from '../../../src/core/block/Flow';
import {StreamDispatcher} from '../../core/block/Dispatcher';
import {encodeFileName} from '../../core/util/Path';
import shelljs from 'shelljs';

export class FlowIOTask extends StreamDispatcher<string> {
  current?: 'write' | 'delete' | 'read';
  next?: 'write' | 'delete';
  reading: Promise<string>;
  _resolveReading: Function;
  nextData: string;

  constructor(
    public readonly loader: FileStorage,
    public readonly name: string,
    public readonly path: string
  ) {
    super();
  }

  read() {
    if (!this.reading) {
      this.reading = new Promise<string>((resolve) => {
        this._resolveReading = resolve;
      });
      this.current = 'read';
      Fs.readFile(this.path, 'utf8', this.onRead);
    }
    return this.reading;
  }
  onRead = (err: NodeJS.ErrnoException | null, data: string) => {
    if (this._resolveReading) {
      this._resolveReading(data);
      this._resolveReading = null;
      this.onDone();
    }
  };

  write(data: string) {
    if (this.next || this.current) {
      this.next = 'write';
      this.nextData = data;
    } else {
      this.current = 'write';
      Fs.writeFile(this.path, data, this.onDone);
      this.reading = Promise.resolve(data);
      this.dispatch(data);
    }
  }

  delete() {
    if (this.next) {
      if (this.next !== 'delete') {
        this.next = 'delete';
        this.nextData = null;
      }
    } else if (this.current) {
      if (this.current !== 'delete') {
        this.next = 'delete';
        this.nextData = null;
      }
    } else {
      this.current = 'delete';
      Fs.unlink(this.path, this.onDone);
      this.dispatch(null);
    }
  }

  onDone = () => {
    this.current = null;
    if (this.next) {
      let {next, nextData} = this;
      this.next = null;
      this.nextData = null;

      switch (next) {
        case 'delete':
          this.delete();
          return;
        case 'write':
          this.write(nextData);
          return;
      }
    } else if (this.reading) {
      let ignoredPromise = this.read();
    } else {
      this.loader.taskDone(this);
    }
  };
}

export class FileStorage implements Storage {
  readonly dir: string;

  constructor(
    dir: string,
    public readonly ext: string = ''
  ) {
    this.dir = Path.resolve(dir);
    if (!Fs.existsSync(this.dir)) {
      shelljs.mkdir('-p', this.dir);
    }
  }

  tasks: Map<string, FlowIOTask> = new Map();

  getTask(name: string) {
    if (this.tasks.has(name)) {
      return this.tasks.get(name);
    } else {
      let task = new FlowIOTask(this, name, Path.join(this.dir, `${encodeFileName(name)}${this.ext}`));
      this.tasks.set(name, task);
      return task;
    }
  }
  taskDone(task: FlowIOTask) {
    if (this.tasks.get(task.name) === task) {
      this.tasks.delete(task.name);
    }
  }

  delete(name: string) {
    this.getTask(name).delete();
  }
  save(key: string, data: string): void {
    let task = this.getTask(key);
    task.write(data);
  }
  async load(name: string) {
    try {
      return await this.getTask(name).read();
    } catch (e) {
      return null;
    }
  }

  listen(key: string, listener: (val: string) => void) {
    this.getTask(key).listen(listener);
  }

  unlisten(key: string, listener: (val: string) => void) {
    this.getTask(key)?.unlisten(listener);
  }
}
export class FileFlowStorage extends FileStorage implements FlowStorage {
  constructor(dir: string) {
    super(dir, '.ticlo');
  }

  getFlowLoader(key: string, prop: BlockProperty): FlowLoader {
    return {
      applyChange: (data: DataMap) => {
        this.saveFlow(null, data, key);
        return true;
      },
      onStateChange: (flow: Flow, state: FlowState) => this.flowStateChanged(flow, key, state),
    };
  }

  flowStateChanged(flow: Flow, name: string, state: FlowState) {
    switch (state) {
      case FlowState.destroyed:
        this.delete(name);
        break;
    }
  }

  saveFlow(flow: Flow, data?: DataMap, overrideKey?: string) {
    if (!data) {
      data = flow.save();
    }
    let key = overrideKey ?? flow._storageKey;
    let str = encodeSorted(data);
    this.save(key, str);
  }

  async loadFlow(name: string) {
    try {
      let str = await this.load(name);
      return decode(str); // decode(null) will return null
    } catch (e) {}
    return null;
  }

  inited = false;
  init(root: Root): void {
    let flowFiles: string[] = [];
    let functionFiles: string[] = [];
    let globalData = {'#is': ''};
    for (let file of Fs.readdirSync(this.dir)) {
      if (
        file.endsWith(this.ext) &&
        !file.includes('.#') // Do not load subflow during initialization.
      ) {
        let name = file.substring(0, file.length - this.ext.length);
        if (name === '#global') {
          try {
            globalData = decode(Fs.readFileSync(Path.join(this.dir, `${name}${this.ext}`), 'utf8'));
          } catch (err) {
            // TODO Logger
          }
        } else if (file.startsWith('#.')) {
          functionFiles.push(name.substring(2));
        } else {
          flowFiles.push(name);
        }
      }
    }

    // load custom types
    for (let name of functionFiles.sort()) {
      try {
        let data = decode(Fs.readFileSync(Path.join(this.dir, `#.${name}${this.ext}`), 'utf8'));
        let desc = WorkerFunction.collectDesc(`:${name}`, data);
        WorkerFunction.registerType(data, desc, '');
      } catch (err) {
        // TODO Logger
      }
    }

    // load global block
    root.loadGlobal(globalData, (saveData: DataMap) => {
      this.saveFlow(root._globalRoot, saveData);
      return true;
    });

    // load flow entries
    // sort the name to make sure parent Flow is loaded before children flows
    for (let name of flowFiles.sort()) {
      try {
        let data = decode(Fs.readFileSync(Path.join(this.dir, `${name}${this.ext}`), 'utf8'));
        root.addFlow(name, data);
      } catch (err) {
        // TODO Logger
      }
    }
    this.inited = true;
  }
}
