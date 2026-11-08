import type {BlockProperty} from '../block/BlockProperty.ts';
import type {Flow, FlowLoader, Root} from '../block/Flow.ts';
import type {FlowStorage, LibraryMetadata, Storage} from '../block/Storage.ts';
import type {DataMap} from '../util/DataTypes.ts';
import {decode, encodeSorted} from '../util/Serialize.ts';
import {flowStoragePath, splitFlowStorageKey, validFlowEntry} from '../util/FlowStoragePath.ts';
import {readLibraryMetadata, validateLibrary} from '../util/LibraryMetadata.ts';
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
  private readonly localBackupFlows = new Set<string>();
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
    const [library, name] = splitFlowStorageKey(key);
    return {files: this, path: `${library || '#root'}/${flowStoragePath(name)}`};
  }
  isPersistent(library: string) {
    return this.getCapabilities(projectId(library)).persistent;
  }
  canWriteFlow(key: string) {
    if (key === '#temp' || key.startsWith('#temp.')) return true;
    if (key === '#global' || key.startsWith('#global.')) return this.user.getCapabilities('#global.ticlo').write;
    const library = key.startsWith('+') ? key.slice(1).split('.')[0].split(':')[0] : '#root';
    return this.getCapabilities(library).write;
  }
  hasLocalBackup(key: string) {
    return this.localBackupFlows.has(key);
  }
  async loadFlow(key: string): Promise<DataMap | null> {
    return this.enqueue(key, async () => {
      const {files, path} = this.flowFile(key);
      try {
        const result = await files.getFile(path);
        this.revisions.set(key, result.revision ?? null);
        if (result.localBackup) this.localBackupFlows.add(key);
        else this.localBackupFlows.delete(key);
        return decode(new TextDecoder().decode(result.data));
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
        this.revisions.set(key, null);
        this.localBackupFlows.delete(key);
        return null;
      }
    });
  }
  saveFlow(flow: Flow | null, data: DataMap | null, key: string) {
    const text = encodeSorted(data ?? flow?.save());
    return this.enqueue(key, async () => {
      const {files, path} = this.flowFile(key);
      const result = await files.uploadFile(path, text, {
        revision: this.revisions.get(key) ?? null,
        backupOnFailure: true,
      });
      this.revisions.set(key, result.revision ?? null);
      this.localBackupFlows.delete(key);
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
      this.localBackupFlows.delete(key);
    });
  }
  createFolder(key: string) {
    const [libraryId, name] = splitFlowStorageKey(key);
    return this.createDirectory(`${libraryId || '#root'}/${flowStoragePath(name, true)}`);
  }
  async deleteFolder(key: string) {
    const [libraryId, name] = splitFlowStorageKey(key);
    await Promise.all([...this.pending].filter(([entry]) => entry.startsWith(`${key}.`)).map(([, pending]) => pending));
    await this.deleteFile(`${libraryId || '#root'}/${flowStoragePath(name, true)}`);
    for (const entry of this.revisions.keys()) if (entry.startsWith(`${key}.`)) this.revisions.delete(entry);
  }
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
  saveModule(libraryId: string, module: string, data: DataMap) {
    return this.saveFlow(null, data, `${libraryId ? `${libraryId}.` : ''}:${module}`);
  }
  loadModule(libraryId: string, module: string) {
    return this.loadFlow(`${libraryId ? `${libraryId}.` : ''}:${module}`);
  }
  async getLibraryMetadata(library: string): Promise<LibraryMetadata> {
    validateLibrary(library);
    await this.getFileInfo(library);
    this.projects.add(library);
    try {
      return readLibraryMetadata(
        JSON.parse(new TextDecoder().decode((await this.getFile(`${library}/ticlo.json`)).data))
      );
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not-found') return {};
      throw error;
    }
  }
  async saveLibraryMetadata(library: string, metadata: LibraryMetadata) {
    validateLibrary(library);
    metadata = readLibraryMetadata(metadata);
    if (!this.isPersistent(library)) throw new StorageError('Storage is read-only', 'readonly');
    const path = `${library}/ticlo.json`;
    await this.enqueue(path, async () => {
      let revision: string | null = null;
      try {
        revision = (await this.getFile(path)).revision ?? null;
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
      }
      await this.uploadFile(path, JSON.stringify(metadata, null, 2), {revision, backupOnFailure: true});
    });
  }
  async listFlows(library: string, folders?: string[]) {
    validateLibrary(library);
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
    await visit(library);
    return result.sort();
  }
  async init(root: Root) {
    root.loadGlobal((await this.loadFlow('#global')) ?? {'#is': ''}, this.getFlowLoader('#global').applyChange);
    if (this.hasLocalBackup('#global')) root._globalRoot.updateValue('@has-change', true);
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
      return {...JSON.parse(new TextDecoder().decode((await this.getFile(`${id}/.proj`, options)).data)), id};
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
    }
    try {
      const legacy = await this.getFile(`${id}/_proj.json`, options);
      if (this.getCapabilities(id).write) {
        await this.uploadFile(`${id}/.proj`, legacy.data, {revision: null});
        await this.deleteFile(`${id}/_proj.json`, {revision: legacy.revision});
      }
      return {...JSON.parse(new TextDecoder().decode(legacy.data)), id};
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
      await this.uploadFile(`${id}/.proj`, JSON.stringify({...metadata, id}), {revision: null});
      return {...metadata, id};
    }
    throw new StorageError('Project already exists', 'conflict');
  }
  async updateProject(id: string, metadata: Record<string, unknown>) {
    const previous = await this.readProject(id);
    const value = {...previous, ...metadata, id};
    await this.uploadFile(`${id}/.proj`, JSON.stringify(value));
    return value;
  }
  async deleteProject(id: string) {
    return this.deleteFile(projectId(id));
  }

  /** String storage functions share the same files and project routing. */
  getValueStorage(library: string): Storage {
    validateLibrary(library);
    if (this.values.has(library)) return this.values.get(library);
    const path = (key: string) => `${library}/#storage/${encodeURIComponent(key)}.str`;
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
    this.values.set(library, storage);
    return storage;
  }
}
