import Fs from 'fs';
import Path from 'path';
import {Flow, Root, encodeSorted, decode, DataMap, Storage} from '../../../src/core';
import {WorkerFunction} from '../../core/worker/WorkerFunction';

class FlowIOTask {
  current?: 'write' | 'delete';
  next?: 'write' | 'delete';
  nextData: string;

  constructor(public loader: FileStorage, public name: string, public path: string) {}

  write(data: string) {
    if (this.next || this.current) {
      this.next = 'write';
      this.nextData = data;
    } else {
      this.current = 'write';
      Fs.writeFile(this.path, data, this.onDone);
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
    }
  }

  onDone = () => {
    if (this.next) {
      let {next, nextData} = this;
      this.next = null;
      this.nextData = null;
      this.current = null;
      switch (next) {
        case 'delete':
          this.delete();
          return;
        case 'write':
          this.write(nextData);
          return;
      }
    } else {
      this.loader.taskDone(this);
    }
  };
}

export class FileStorage implements Storage {
  tasks: Map<string, FlowIOTask> = new Map();

  getTask(name: string) {
    if (this.tasks.has(name)) {
      return this.tasks.get(name);
    } else {
      let task = new FlowIOTask(this, name, Path.join(this.dir, `${name}.ticlo`));
      this.tasks.set(name, task);
      return task;
    }
  }
  taskDone(task: FlowIOTask) {
    if (this.tasks.get(task.name) === task) {
      this.tasks.delete(task.name);
    }
  }

  dir: string;
  constructor(dir: string) {
    this.dir = Path.resolve(dir);
  }

  deleteFlow(name: string) {
    this.getTask(name).delete();
  }
  saveFlow(name: string, flow: Flow, data?: DataMap) {
    if (!data) {
      data = flow.save();
    }
    let str = encodeSorted(flow.save());
    this.getTask(name).write(str);
  }
  init(root: Root): void {
    let flowFiles: string[] = [];
    let functionFiles: string[] = [];
    let globalData = {'#is': ''};
    for (let file of Fs.readdirSync(this.dir)) {
      if (file.endsWith('.ticlo')) {
        let name = file.substring(0, file.length - '.ticlo'.length);
        if (name === '#global') {
          try {
            globalData = decode(Fs.readFileSync(Path.join(this.dir, `${name}.ticlo`), 'utf8'));
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
        let data = decode(Fs.readFileSync(Path.join(this.dir, `#.${name}.ticlo`), 'utf8'));
        let desc = WorkerFunction.collectDesc(`:${name}`, data);
        WorkerFunction.registerType(data, desc, '');
      } catch (err) {
        // TODO Logger
      }
    }

    // load global block
    root._globalRoot.load(globalData, null, (saveData: DataMap) => {
      this.saveFlow('#global', root._globalRoot, saveData);
      return true;
    });

    // load flow entries
    // sort the name to make sure parent Flow is loaded before children flows
    for (let name of flowFiles.sort()) {
      try {
        let data = decode(Fs.readFileSync(Path.join(this.dir, `${name}.ticlo`), 'utf8'));
        root.addFlow(name, data);
      } catch (err) {
        // TODO Logger
      }
    }
  }
}
