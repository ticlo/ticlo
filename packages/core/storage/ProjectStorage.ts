import type {BlockProperty} from '../block/BlockProperty.ts';
import type {Flow, FlowLoader, Root} from '../block/Flow.ts';
import type {FlowStorage, NamespaceMetadata, Storage} from '../block/Storage.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {decode, encodeSorted} from '../util/Serialize.ts';
import {flowStoragePath, splitFlowStorageKey, validFlowEntry} from '../util/FlowStoragePath.ts';
import {readNamespaceMetadata, validateNamespace} from '../util/NamespaceMetadata.ts';
import {StreamDispatcher} from '../block/Dispatcher.ts';
import {
  FileAccessBase,
  StorageError,
  projectId,
  type FileAccess,
  type FileRequest,
  type ProjectFiles,
  type ProjectMetadata,
} from './FileAccess.ts';

/** Shared file-to-flow mapping. Backends implement only file operations. */
export abstract class ProjectStorage extends FileAccessBase implements FlowStorage, ProjectFiles {
  abstract readonly user: FileAccess;
  inited = false;
  readonly projects = new Set<string>();
  private readonly revisions = new Map<string, string | null>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly values = new Map<string, Storage>();
  private readonly changes = new Map<string, StreamDispatcher<string>>();

  protected enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const pending = (this.pending.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
    this.pending.set(key, pending);
    return pending.finally(() => {
      if (this.pending.get(key) === pending) this.pending.delete(key);
    });
  }
  flowFile(key: string): {files: FileAccess; path: string} {
    if (key === '#global') return {files: this.user, path: '#global.ticlo'};
    const [namespace, name] = splitFlowStorageKey(key);
    return {files: this, path: `${namespace || '#root'}/${flowStoragePath(name)}`};
  }
  isPersistent(namespace: string) {
    return this.getCapabilities(projectId(namespace)).persistent;
  }
  canWriteFlow(key: string) {
    if (key === '#temp' || key.startsWith('#temp.')) return true;
    if (key === '#global' || key.startsWith('#global.')) return this.user.getCapabilities('#global.ticlo').write;
    const namespace = key.startsWith('+') ? key.slice(1).split('.')[0].split(':')[0] : '#root';
    return this.getCapabilities(namespace).write;
  }
  // REFACTOR(design.md): MUST validate the file version and migrate old binding paths explicitly.
  async loadFlow(key: string): Promise<DataMap | null> {
    return this.enqueue(key, async () => {
      const {files, path} = this.flowFile(key);
      try {
        const result = await files.getFile(path);
        this.revisions.set(key, result.revision ?? null);
        return decode(new TextDecoder().decode(result.data));
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
        this.revisions.set(key, null);
        return null;
      }
    });
  }
  // REFACTOR(design.md): MUST persist versioned IDs, ports, ordered wires, and route points.
  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    const text = encodeSorted(data ?? flow?.save());
    return this.enqueue(key, async () => {
      const {files, path} = this.flowFile(key);
      const result = await files.uploadFile(path, text, {revision: this.revisions.get(key) ?? null});
      this.revisions.set(key, result.revision ?? null);
    });
  }
  delete(key: string) {
    return this.enqueue(key, async () => {
      const {files, path} = this.flowFile(key);
      // Deletions need a revision even if the flow was never opened.
      let revision = this.revisions.get(key);
      if (revision === undefined) {
        try {
          revision = (await files.getFile(path)).revision;
        } catch (error) {
          if (error instanceof StorageError && error.code === 'not-found') return;
          throw error;
        }
      }
      await files.deleteFile(path, {revision});
      this.revisions.delete(key);
    });
  }
  createFolder(key: string) {
    const [ns, name] = splitFlowStorageKey(key);
    return this.createDirectory(`${ns || '#root'}/${flowStoragePath(name, true)}`);
  }
  async deleteFolder(key: string) {
    const [ns, name] = splitFlowStorageKey(key);
    await Promise.all([...this.pending].filter(([entry]) => entry.startsWith(`${key}.`)).map(([, pending]) => pending));
    await this.deleteFile(`${ns || '#root'}/${flowStoragePath(name, true)}`);
    for (const entry of this.revisions.keys()) if (entry.startsWith(`${key}.`)) this.revisions.delete(entry);
  }
  // REFACTOR(design.md): MUST return the versioned graph snapshot used for save and undo history.
  getFlowLoader(key: string, _prop?: BlockProperty): FlowLoader {
    this.flowFile(key);
    return {
      applyChange: async (flow) => {
        const data = flow.save();
        await this.saveFlow(null, data, key);
        return data;
      },
    };
  }
  saveLib(ns: string, lib: string, data: DataMap) {
    return this.saveFlow(null, data, `${ns ? `${ns}.` : ''}:${lib}`);
  }
  loadLib(ns: string, lib: string) {
    return this.loadFlow(`${ns ? `${ns}.` : ''}:${lib}`);
  }
  async getNamespaceMetadata(namespace: string): Promise<NamespaceMetadata> {
    validateNamespace(namespace);
    await this.getFileInfo(namespace);
    this.projects.add(namespace);
    try {
      return readNamespaceMetadata(
        JSON.parse(new TextDecoder().decode((await this.getFile(`${namespace}/ticlo.json`)).data))
      );
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not-found') return {};
      throw error;
    }
  }
  async saveNamespaceMetadata(namespace: string, metadata: NamespaceMetadata) {
    validateNamespace(namespace);
    readNamespaceMetadata(metadata);
    if (!this.isPersistent(namespace)) throw new StorageError('Storage is read-only', 'readonly');
    const path = `${namespace}/ticlo.json`;
    await this.enqueue(path, async () => {
      let revision: string | null = null;
      try {
        revision = (await this.getFile(path)).revision ?? null;
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
      }
      await this.uploadFile(path, JSON.stringify(metadata, null, 2), {revision});
    });
  }
  async listFlows(namespace: string, folders?: string[]) {
    validateNamespace(namespace);
    const result: string[] = [];
    const visit = async (path: string, prefix = '') => {
      for (const entry of await this.listFiles(path)) {
        if (entry.type === 'folder' && validFlowEntry(entry.name)) {
          folders?.push(prefix + entry.name);
          await visit(entry.path, `${prefix}${entry.name}.`);
        } else if (entry.type === 'file' && entry.name.endsWith('.ticlo')) {
          const name = entry.name.slice(0, -6);
          if (validFlowEntry(name)) result.push(prefix + name);
        }
      }
    };
    await visit(namespace);
    return result.sort();
  }
  async init(root: Root) {
    root.loadGlobal((await this.loadFlow('#global')) ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);
    this.inited = true;
  }
  async listProjects(options?: FileRequest): Promise<ProjectMetadata[]> {
    const folders = (await this.listFiles('', options)).filter((entry) => entry.type === 'folder');
    return Promise.all(folders.map((entry) => this.readProject(entry.name, options)));
  }
  async readProject(id: string, options?: FileRequest): Promise<ProjectMetadata> {
    projectId(id);
    await this.getFileInfo(id, options);
    try {
      return {...JSON.parse(new TextDecoder().decode((await this.getFile(`${id}/_proj.json`, options)).data)), id};
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not-found') return {id};
      throw error;
    }
  }
  async createProject(id: string, metadata: Record<string, unknown> = {}) {
    projectId(id);
    try {
      await this.getFileInfo(id);
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
      await this.createDirectory(id);
      await this.uploadFile(`${id}/_proj.json`, JSON.stringify({...metadata, id}), {revision: null});
      return {...metadata, id};
    }
    throw new StorageError('Project already exists', 'conflict');
  }
  async updateProject(id: string, metadata: Record<string, unknown>) {
    const previous = await this.readProject(id);
    const value = {...previous, ...metadata, id};
    await this.uploadFile(`${id}/_proj.json`, JSON.stringify(value));
    return value;
  }
  async deleteProject(id: string) {
    return this.deleteFile(projectId(id));
  }

  /** String storage functions share the same files and project routing. */
  getValueStorage(namespace: string): Storage {
    validateNamespace(namespace);
    if (this.values.has(namespace)) return this.values.get(namespace);
    const path = (key: string) => `${namespace}/#storage/${encodeURIComponent(key)}.str`;
    const notify = (key: string, value: string) => this.changes.get(path(key))?.dispatch(value);
    const revisions = new Map<string, string | null>();
    const read = async (key: string) => {
      try {
        const result = await this.getFile(path(key));
        revisions.set(key, result.revision ?? null);
        return new TextDecoder().decode(result.data);
      } catch (error) {
        if (error instanceof StorageError && error.code === 'not-found') {
          revisions.set(key, null);
          return null;
        }
        throw error;
      }
    };
    const storage: Storage = {
      load: (key) => this.enqueue(path(key), () => read(key)),
      save: (key, value) =>
        this.enqueue(path(key), async () => {
          const result = await this.uploadFile(path(key), value, {revision: revisions.get(key) ?? null});
          revisions.set(key, result.revision ?? null);
          notify(key, value);
        }),
      delete: (key) =>
        this.enqueue(path(key), async () => {
          if (!revisions.has(key)) await read(key);
          if (revisions.get(key) !== null) await this.deleteFile(path(key), {revision: revisions.get(key)});
          revisions.set(key, null);
          notify(key, null);
        }),
      listen: (key, listener) => {
        let stream = this.changes.get(path(key));
        if (!stream) this.changes.set(path(key), (stream = new StreamDispatcher()));
        stream.listen(listener);
      },
      unlisten: (key, listener) => {
        const stream = this.changes.get(path(key));
        stream?.unlisten(listener);
        if (stream?.isEmpty()) this.changes.delete(path(key));
      },
    };
    this.values.set(namespace, storage);
    return storage;
  }
}
