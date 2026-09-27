import {DataMap, decode, encodeSorted, Flow, FlowStorage, Root, Storage} from '@ticlo/core';
import {NamespaceMetadata} from '@ticlo/core/block/Storage.ts';
import {readNamespaceMetadata, validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {FlowLoader} from '@ticlo/core/block/Flow.ts';
import {StreamDispatcher} from '@ticlo/core/block/Dispatcher.ts';
import {encodeFileName, validateNodePath} from '@ticlo/core/util/Path.ts';
import {TicloFileClient} from '@ticlo/file-client';
import {
  flowStoragePath,
  reservedFlowFolders,
  splitFlowStorageKey,
  validFlowEntry,
} from '@ticlo/core/util/FlowStoragePath.ts';

/** HTTP storage with serialized mutations and optimistic concurrency control. */
export class FileServerStorage implements Storage {
  readonly streams = new Map<string, StreamDispatcher<string>>();
  readonly errors = new StreamDispatcher<Error>();
  protected readonly revisions = new Map<string, string>();
  protected readonly pending = new Map<string, Promise<unknown>>();

  constructor(
    public readonly client: TicloFileClient,
    public readonly dir: string,
    public readonly ext = ''
  ) {}

  protected getPath(key: string) {
    return `${this.dir}/${encodeFileName(key)}${this.ext}`;
  }

  protected enqueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const pending = (this.pending.get(path) ?? Promise.resolve()).catch(() => {}).then(operation);
    this.pending.set(path, pending);
    const result = pending.finally(() => {
      if (this.pending.get(path) === pending) this.pending.delete(path);
    });
    result.catch((error) => this.errors.dispatch(error instanceof Error ? error : new Error(String(error))));
    return result;
  }

  protected async read(path: string): Promise<string> {
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

const ROOT_PROJECT = '#root';
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
    const [namespace, name] = splitFlowStorageKey(key);
    return `proj/${namespace || ROOT_PROJECT}/${flowStoragePath(name)}`;
  }

  private folderPath(key: string) {
    const [namespace, name] = splitFlowStorageKey(key);
    return `proj/${namespace || ROOT_PROJECT}/${flowStoragePath(name, true)}`;
  }

  createFolder(key: string) {
    const path = this.folderPath(key);
    return this.enqueue(path, () => this.client.createDirectory(path));
  }

  deleteFolder(key: string) {
    const path = this.folderPath(key);
    const children = [...this.pending].filter(([entry]) => entry.startsWith(`${path}/`)).map(([, pending]) => pending);
    return this.enqueue(path, async () => {
      await Promise.all(children);
      await this.client.deleteFile(path);
      for (const entry of this.revisions.keys()) {
        if (entry.startsWith(`${path}/`)) this.revisions.delete(entry);
      }
    });
  }

  getFlowLoader(key: string): FlowLoader {
    this.getPath(key);
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

  async getNamespaceMetadata(namespace: string): Promise<NamespaceMetadata> {
    validateNamespace(namespace);
    const path = `proj/${namespace}/ticlo.json`;
    const text = await this.enqueue(path, () => this.read(path));
    if (text == null) await this.client.getFileInfo(`proj/${namespace}`);
    this.projects.add(namespace);
    return readNamespaceMetadata(text == null ? undefined : JSON.parse(text));
  }

  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata): Promise<void> {
    validateNamespace(namespace);
    readNamespaceMetadata(metadata);
    const path = `proj/${namespace}/ticlo.json`;
    await this.enqueue(path, async () => {
      const text = await this.read(path);
      if (text == null) await this.client.getFileInfo(`proj/${namespace}`);
      const data = metadata;
      const response = await this.client.uploadFileResponse(
        path,
        JSON.stringify(data, null, 2),
        {},
        {
          headers: text == null ? {'If-None-Match': '*'} : {'If-Match': this.revisions.get(path)},
        }
      );
      this.revisions.set(path, response.headers.etag);
    });
  }

  async listFlows(namespace: string, folders?: string[]): Promise<string[]> {
    validateNamespace(namespace);
    const result: string[] = [];
    const visit = async (path: string, prefix = '') => {
      for (const file of await this.client.listFiles(path)) {
        if (file.type === 'folder' && validFlowEntry(file.name)) {
          folders?.push(`${prefix}${file.name}`);
          await visit(`${path}/${file.name}`, `${prefix}${file.name}.`);
        } else if (file.type === 'file' && file.name.endsWith(this.ext)) {
          const name = file.name.slice(0, -this.ext.length);
          if (validFlowEntry(name)) result.push(`${prefix}${name}`);
        }
      }
    };
    await visit(`proj/${namespace}`);
    return result.sort();
  }

  async init(root: Root) {
    await this.client.getFileInfo(`proj/${ROOT_PROJECT}`);
    const globalData = await this.loadFlow('#global');
    root.loadGlobal(globalData ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);
    this.inited = true;
  }
}
