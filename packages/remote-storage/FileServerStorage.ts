import {DataMap, decode, encodeSorted, Flow, FlowStorage, Root, Storage} from '@ticlo/core';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {encodeFileName, validateNodePath} from '@ticlo/core/util/Path.ts';
import {TicloFileClient} from '@ticlo/file-client';

/** HTTP storage with serialized mutations and optimistic concurrency control. */
export class FileServerStorage implements Storage {
  readonly streams = new Map<string, StreamDispatcher<string>>();
  readonly errors = new StreamDispatcher<Error>();
  private readonly revisions = new Map<string, string>();
  private readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    public readonly client: TicloFileClient,
    public readonly dir: string,
    public readonly ext = ''
  ) {}

  protected getPath(key: string) {
    return `${this.dir}/${encodeFileName(key)}${this.ext}`;
  }

  private enqueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const pending = (this.pending.get(path) ?? Promise.resolve()).catch(() => {}).then(operation);
    this.pending.set(path, pending);
    const result = pending.finally(() => {
      if (this.pending.get(path) === pending) this.pending.delete(path);
    });
    result.catch((error) => this.errors.dispatch(error instanceof Error ? error : new Error(String(error))));
    return result;
  }

  private async read(path: string): Promise<string> {
    try {
      const response = await this.client.getFile(path);
      const revision = response.headers.etag;
      if (typeof revision !== 'string') throw new Error(`Missing ETag for ${path}`);
      this.revisions.set(path, revision);
      return new TextDecoder().decode(response.data);
    } catch (error) {
      if ((error as {response?: {status: number}}).response?.status === 404) {
        this.revisions.set(path, null);
        return null;
      }
      throw error;
    }
  }

  load(key: string) {
    const path = this.getPath(key);
    return this.enqueue(path, () => this.read(path));
  }

  save(key: string, data: string): Promise<void> {
    const path = this.getPath(key);
    return this.enqueue(path, async () => {
      // Unread keys are creates, never blind overwrites of an existing file.
      const revision = this.revisions.get(path);
      const headers = revision ? {'If-Match': revision} : {'If-None-Match': '*'};
      const response = await this.client.uploadFileResponse(path, data, {}, {headers});
      this.revisions.set(path, response.headers.etag);
      this.streams.get(key)?.dispatch(data);
    });
  }

  delete(key: string): Promise<void> {
    const path = this.getPath(key);
    return this.enqueue(path, async () => {
      if (!this.revisions.has(path)) await this.read(path);
      const revision = this.revisions.get(path);
      if (revision) await this.client.deleteFile(path, {headers: {'If-Match': revision}});
      this.revisions.set(path, null);
      this.streams.get(key)?.dispatch(null);
    });
  }

  listen(key: string, listener: (value: string) => void) {
    let stream = this.streams.get(key);
    if (!stream) {
      stream = new StreamDispatcher<string>();
      this.streams.set(key, stream);
    }
    stream.listen(listener);
  }

  unlisten(key: string, listener: (value: string) => void) {
    const stream = this.streams.get(key);
    stream?.unlisten(listener);
    if (stream?.isEmpty()) this.streams.delete(key);
  }
}

const ROOT_PROJECT = '_root';
function validProject(id: string) {
  return Boolean(id) && validateNodePath(id);
}

export class FileServerFlowStorage extends FileServerStorage implements FlowStorage {
  inited = false;
  readonly projects = new Set<string>();

  constructor(
    client: TicloFileClient,
    public readonly initialProject = ROOT_PROJECT
  ) {
    super(client, 'proj', '.ticlo');
    if (!validProject(initialProject)) throw new Error('Invalid project id');
  }

  protected getPath(key: string) {
    let project = ROOT_PROJECT;
    if (key.startsWith('+')) {
      const dot = key.indexOf('.');
      project = key.slice(1, dot);
      key = key.slice(dot + 1);
      if (dot < 2 || !validProject(project)) throw new Error('Invalid namespace');
    }
    const name = key.startsWith(':') ? `libs/${encodeFileName(key.slice(1))}` : encodeFileName(key);
    return `proj/${project}/${name}${this.ext}`;
  }

  getFlowLoader(key: string): FlowLoader {
    return {
      applyChange: async (flow) => {
        const data = flow.save();
        await this.saveFlow(null, data, key);
        return data;
      },
    };
  }

  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    return this.save(key, encodeSorted(data ?? flow?.save()));
  }

  async loadFlow(key: string): Promise<DataMap | null> {
    const text = await this.load(key);
    return text === null ? null : decode(text);
  }

  saveLib(ns: string, lib: string, data: DataMap) {
    return this.saveFlow(null, data, `${ns ? `${ns}.` : ''}:${lib}`);
  }

  loadLib(ns: string, lib: string) {
    return this.loadFlow(`${ns ? `${ns}.` : ''}:${lib}`);
  }

  async init(root: Root) {
    await this.client.readProject(ROOT_PROJECT);
    const globalData = await this.loadFlow('#global');
    root.loadGlobal(globalData ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);

    const loadProject = async (project: string) => {
      if (this.projects.has(project)) return;
      await this.client.readProject(project);
      this.projects.add(project);
      if (project !== ROOT_PROJECT) root.addFlowFolder(`+${project}`);
      const deps = await this.client.listFiles(`proj/${project}/deps`);
      for (const entry of deps.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.type === 'folder' && validProject(entry.name)) await loadProject(entry.name);
      }
      const files = await this.client.listFiles(`proj/${project}`);
      for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
        if (file.type !== 'file' || !file.name.endsWith(this.ext)) continue;
        const name = file.name.slice(0, -this.ext.length);
        // Subflows and libraries are loaded on demand, not as ordinary flows.
        if (!name.split('.').every((part) => part && validateNodePath(part) && !/^[#+:]/.test(part))) continue;
        const key = project === ROOT_PROJECT ? name : `+${project}.${name}`;
        const data = await this.loadFlow(key);
        if (data) root.addFlow(key, data, null, true);
      }
    };
    await loadProject(this.initialProject);
    this.inited = true;
  }
}
