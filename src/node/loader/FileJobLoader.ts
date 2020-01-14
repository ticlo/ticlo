import Fs from 'fs';
import Path from 'path';
import {Job, Root, encodeSorted, decode, DataMap} from '../../../src/core';

class JobIOTask {
  current?: 'write' | 'delete';
  next?: 'write' | 'delete';
  nextData: string;

  constructor(public loader: FileJobLoader, public name: string, public path: string) {}

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

export class FileJobLoader {
  tasks: Map<string, JobIOTask> = new Map();

  getTask(name: string) {
    if (this.tasks.has(name)) {
      return this.tasks.get(name);
    } else {
      let task = new JobIOTask(this, name, Path.join(this.dir, `${name}.ticlo`));
      this.tasks.set(name, task);
      return task;
    }
  }
  taskDone(task: JobIOTask) {
    if (this.tasks.get(task.name) === task) {
      this.tasks.delete(task.name);
    }
  }

  dir: string;
  constructor(dir: string) {
    this.dir = Path.resolve(dir);
  }

  onAddJob(root: Root, name: string, job: Job, data: DataMap) {
    this.saveJob(root, name, job, data);
  }
  onDeleteJob(root: Root, name: string, job: Job) {
    this.getTask(name).delete();
  }
  saveJob(root: Root, name: string, job: Job, data?: DataMap) {
    if (!data) {
      data = job.save();
    }
    let str = encodeSorted(job.save());
    this.getTask(name).write(str);
  }
  init(root: Root): void {
    for (let file of Fs.readdirSync(this.dir)) {
      if (file.endsWith('.ticlo')) {
        try {
          let name = file.substring(0, file.length - '.ticlo'.length);
          let data = decode(Fs.readFileSync(Path.join(this.dir, file), 'utf8'));
          root.addJob(name, data);
        } catch (err) {
          // TODO Logger
        }
      }
    }
  }
}
