import Fs from 'fs';
import Path from 'path';
import {BlockProperty, DataMap, decode, encodeSorted, Flow, Root, FlowStorage, Storage} from '@ticlo/core';
import {NamespaceMetadata} from '@ticlo/core/block/Storage.ts';
import {readNamespaceMetadata, validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {encodeFileName} from '@ticlo/core/util/Path.ts';
import {
  flowStoragePath,
  reservedFlowFolders,
  splitFlowStorageKey,
  validFlowEntry,
} from '@ticlo/core/util/FlowStoragePath.ts';

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
    public readonly loader: FileStorage,
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

export class FileStorage implements Storage {
  readonly dir: string;

  constructor(
    dir: string,
    public readonly ext: string = ''
  ) {
    this.dir = Path.resolve(dir);
    if (!Fs.existsSync(this.dir)) {
      Fs.mkdirSync(this.dir, {recursive: true});
    }
  }

  tasks: {[key: string]: FlowIOTask} = Object.create(null);

  getTask(name: string) {
    if (this.tasks[name]) {
      return this.tasks[name];
    } else {
      const task = new FlowIOTask(this, name, this.getPath(name));
      this.tasks[name] = task;
      return task;
    }
  }
  protected getPath(name: string) {
    if (name.startsWith('+')) {
      const firstDot = name.indexOf('.');
      return Path.join(
        this.dir,
        encodeFileName(name.slice(0, firstDot)),
        `${encodeFileName(name.slice(firstDot + 1))}${this.ext}`
      );
    }
    return Path.join(this.dir, `${encodeFileName(name)}${this.ext}`);
  }

  taskDone(task: FlowIOTask) {
    if (this.tasks[task.name] === task) {
      delete this.tasks[task.name];
    }
  }

  delete(name: string) {
    this.getTask(name).delete();
  }
  save(key: string, data: string): void {
    const task = this.getTask(key);
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
    const task = this.tasks[key];
    if (task) {
      task.unlisten(listener);
      if (task.isEmpty() && !task.current && !task.next && !task.reading) {
        this.taskDone(task);
      }
    }
  }
}
export class FileFlowStorage extends FileStorage implements FlowStorage {
  constructor(dir: string) {
    super(dir, '.ticlo');
  }

  protected getPath(key: string) {
    const [namespace, name] = splitFlowStorageKey(key);
    return Path.join(this.dir, namespace ? `+${namespace}` : '', flowStoragePath(name));
  }

  private folderPath(key: string) {
    const [namespace, name] = splitFlowStorageKey(key);
    return Path.join(this.dir, namespace ? `+${namespace}` : '', flowStoragePath(name, true));
  }

  createFolder(key: string) {
    Fs.mkdirSync(this.folderPath(key), {recursive: true});
  }

  async deleteFolder(key: string) {
    const path = this.folderPath(key);
    const tasks = Object.values(this.tasks).filter((task) => task.path.startsWith(`${path}${Path.sep}`));
    await Promise.all(tasks.map((task) => task.whenIdle()));
    await Fs.promises.rm(path, {recursive: true, force: true});
    for (const task of tasks) delete this.tasks[task.name];
  }

  save(key: string, data: string) {
    Fs.mkdirSync(Path.dirname(this.getPath(key)), {recursive: true});
    super.save(key, data);
    return this.getTask(key).whenIdle();
  }

  getFlowLoader(key: string, prop: BlockProperty): FlowLoader {
    this.getPath(key);
    return {
      applyChange: (flow: Flow) => {
        const data = flow.save();
        return this.saveFlow(null, data, key).then(() => data);
      },
    };
  }

  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    if (!data) {
      data = flow?.save();
    }
    const str = encodeSorted(data);
    return this.save(key, str);
  }

  async loadFlow(name: string) {
    try {
      const str = await this.load(name);
      return decode(str); // decode(null) will return null
    } catch (e) {}
    return null;
  }

  initNamespace(ns: string) {
    const nsDir = Path.join(this.dir, encodeFileName(ns));
    Fs.mkdirSync(nsDir, {recursive: true});
  }

  saveLib(ns: string, lib: string, data: DataMap) {
    this.initNamespace(ns);
    return this.save(`${ns ? `${ns}.` : ''}:${lib}`, encodeSorted(data));
  }

  async loadLib(ns: string, lib: string): Promise<DataMap | null> {
    try {
      const str = await this.load(`${ns ? `${ns}.` : ''}:${lib}`);
      return decode(str); // decode(null) will return null
    } catch (e) {}
    return null;
  }

  inited = false;
  init(root: Root): void {
    let globalData = {'#is': ''};
    const globalPath = this.getPath('#global');
    if (Fs.existsSync(globalPath)) globalData = decode(Fs.readFileSync(globalPath, 'utf8'));
    root.loadGlobal(globalData, (flow: Flow) => {
      const data = flow.save();
      this.saveFlow(flow, data, '#global');
      return data;
    });

    this.inited = true;
  }

  private namespaceDir(namespace: string) {
    validateNamespace(namespace);
    return Path.join(this.dir, namespace === '#root' ? '' : `+${namespace}`);
  }

  async getNamespaceMetadata(namespace: string): Promise<NamespaceMetadata> {
    const dir = this.namespaceDir(namespace);
    await Fs.promises.access(dir);
    try {
      const data = JSON.parse(await Fs.promises.readFile(Path.join(dir, 'ticlo.json'), 'utf8'));
      return readNamespaceMetadata(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw error;
    }
  }

  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata): Promise<void> {
    readNamespaceMetadata(metadata);
    const path = Path.join(this.namespaceDir(namespace), 'ticlo.json');
    await Fs.promises.writeFile(path, JSON.stringify(metadata, null, 2));
  }

  async listFlows(namespace: string, folders?: string[]): Promise<string[]> {
    const result: string[] = [];
    const visit = async (path: string, prefix = '') => {
      for (const entry of await Fs.promises.readdir(path, {withFileTypes: true})) {
        if (entry.isDirectory() && validFlowEntry(entry.name)) {
          folders?.push(`${prefix}${entry.name}`);
          await visit(Path.join(path, entry.name), `${prefix}${entry.name}.`);
        } else if (entry.isFile() && entry.name.endsWith(this.ext)) {
          const name = entry.name.slice(0, -this.ext.length);
          if (validFlowEntry(name)) result.push(`${prefix}${name}`);
        }
      }
    };
    await visit(this.namespaceDir(namespace));
    return result.sort();
  }
}
