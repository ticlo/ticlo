import Fs from 'node:fs';
import {Flow, Root, type DataMap, type FlowStorage} from '@ticlo/core';
import {decode, encodeSorted} from '@ticlo/core/util/Serialize.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import type {FlowLoader} from '@ticlo/core/block/Flow.ts';
import type {BlockProperty} from '@ticlo/core/block/BlockProperty.ts';
export class FlowIOTask extends StreamDispatcher<string> {
  current?: 'write' | 'delete' | 'read';
  next?: 'write' | 'delete';
  reading: Promise<string>;
  _resolveReading: Function;
  nextData: string;
  private idleResolvers: {resolve: () => void; reject: (error: Error) => void}[] = [];
  private writeError: Error;

  whenIdle(): Promise<void> {
    if (!this.current && !this.next) return this.writeError ? Promise.reject(this.writeError) : Promise.resolve();
    return new Promise((resolve, reject) => this.idleResolvers.push({resolve, reject}));
  }

  constructor(
    public readonly loader: TestFileStorage,
    public readonly name: string,
    public readonly path: string
  ) {
    super();
  }

  read() {
    // Reads observe the latest queued mutation and never start a second file
    // operation while one is already in progress for this key.
    if (!this.current && this.reading) {
      return this.reading;
    }
    if (this.next) {
      return Promise.resolve(this.next === 'write' ? this.nextData : undefined);
    }
    if (this.current) {
      return this.current === 'delete' ? Promise.resolve(undefined) : this.reading;
    }
    this.reading = new Promise<string>((resolve) => {
      this._resolveReading = resolve;
    });
    this.current = 'read';
    Fs.readFile(this.path, 'utf8', this.onRead);
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
      if (!this.idleResolvers.length) this.writeError = undefined;
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

  onDone = (error?: NodeJS.ErrnoException | null) => {
    const completed = this.current;
    if (error && completed === 'write') {
      this.writeError = error;
      this.reading = undefined;
    }
    this.current = null;
    if (this.next) {
      const {next, nextData} = this;
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
    } else if (completed === 'delete') {
      this.reading = undefined;
      if (this.isEmpty()) {
        this.loader.taskDone(this);
      }
    }
    for (const {resolve, reject} of this.idleResolvers.splice(0)) {
      if (this.writeError) reject(this.writeError);
      else resolve();
    }
  };
}

/** The test runner maps source-tree tests directly, outside project storage. */
export abstract class TestFileStorage implements FlowStorage {
  tasks: Record<string, FlowIOTask> = Object.create(null);
  inited = false;
  abstract getTask(name: string): FlowIOTask;
  taskDone(task: FlowIOTask) {
    if (this.tasks[task.name] === task) delete this.tasks[task.name];
  }
  async loadFlow(key: string): Promise<DataMap | null> {
    return decode(await this.getTask(key).read());
  }
  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    const task = this.getTask(key);
    task.write(encodeSorted(data ?? flow?.save()));
    return task.whenIdle();
  }
  async delete(key: string) {
    const task = this.getTask(key);
    task.delete();
    await task.whenIdle();
  }
  async loadLib(_ns: string, _lib: string): Promise<DataMap | null> {
    return null;
  }
  saveLib(_ns: string, _lib: string, _data: DataMap) {
    throw new Error('Test storage does not store libraries');
  }
  getFlowLoader(key: string, _prop?: BlockProperty): FlowLoader {
    return {
      applyChange: async (flow: Flow) => {
        const data = flow.save();
        await this.saveFlow(null, data, key);
        return data;
      },
    };
  }
  abstract init(root: Root): unknown;
}
