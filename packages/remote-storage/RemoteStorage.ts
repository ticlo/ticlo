import {
  FileAccessBase,
  StorageError,
  assertWritable,
  filePath,
  fileBytes,
  projectId,
  type FileEntry,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
  type GitCommit,
  type GitInfo,
  type LocalBackupAccess,
  type ProjectGit,
  type ProjectMetadata,
} from '@ticlo/core/storage/FileAccess.ts';
import {BrowserStorage} from './BrowserStorage.ts';
import {LocalFileBackups, type LocalFileBackup} from './LocalFileBackups.ts';

export interface RemoteStorageOptions {
  baseURL: string;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}
class RemoteFiles extends FileAccessBase {
  private readonly listCache = new Map<string, FileEntry[]>();
  constructor(
    private readonly options: RemoteStorageOptions,
    private readonly prefix: () => Promise<string>,
    private readonly backups: LocalFileBackups,
    private readonly changed: (path: string) => void,
    private readonly backupScope: () => Promise<string>
  ) {
    super();
  }
  getCapabilities(_path: string) {
    return {write: true, persistent: true};
  }
  private async path(path: string) {
    filePath(path, true);
    return [await this.prefix(), path].filter(Boolean).join('/');
  }
  async request(
    operation: string,
    params: Record<string, string> = {},
    body?: BodyInit,
    options: FileWriteOptions = {}
  ) {
    options.signal?.throwIfAborted();
    const query = new URLSearchParams({op: operation, ...params});
    const headers = new Headers(this.options.headers);
    if (options.existsBehavior === 'fail') query.set('exists', 'fail');
    if (options.revision === null) headers.set('If-None-Match', '*');
    else if (options.revision !== undefined) headers.set('If-Match', options.revision);
    const write = !['get', 'list', 'info', 'listProj', 'readProj', 'user', 'gitInfo', 'gitHistory'].includes(operation);
    if (body !== undefined)
      headers.set(
        'Content-Type',
        ['gitCommit', 'updateProj'].includes(operation) ? 'application/json' : 'application/octet-stream'
      );
    const response = await (this.options.fetch ?? fetch)(`${this.options.baseURL.replace(/\/$/, '')}?${query}`, {
      method: write ? 'POST' : 'GET',
      body,
      headers,
      credentials: this.options.credentials,
      signal: options.signal,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new StorageError(
        message || `HTTP ${response.status}`,
        response.status === 404
          ? 'not-found'
          : response.status === 409 || response.status === 412
            ? 'conflict'
            : response.status === 401 || response.status === 403
              ? 'permission-denied'
              : 'io'
      );
    }
    return response;
  }
  async getFile(path: string, options?: FileRequest) {
    options?.signal?.throwIfAborted();
    const fullPath = await this.path(path);
    const backup = await this.backups.get(await this.backupScope(), fullPath);
    options?.signal?.throwIfAborted();
    if (backup) return {data: backup.data, revision: backup.revision};
    const response = await this.request('get', {path: fullPath}, undefined, options);
    return {
      data: await response.arrayBuffer(),
      revision: this.revision(response),
      contentType: response.headers.get('Content-Type') ?? undefined,
    };
  }
  async getFileInfo(path: string, options?: FileRequest): Promise<FileEntry> {
    options?.signal?.throwIfAborted();
    const fullPath = await this.path(path);
    const scope = await this.backupScope();
    const backup = await this.backups.get(scope, fullPath);
    options?.signal?.throwIfAborted();
    if (backup) return this.backupEntry(backup, path);
    try {
      const response = await this.request('info', {path: fullPath}, undefined, options);
      return {...(await response.json()), path};
    } catch (error) {
      options?.signal?.throwIfAborted();
      if ((await this.backups.list(scope)).some((item) => item.path.startsWith(`${fullPath}/`)))
        return {path, name: path.split('/').pop() ?? '', type: 'folder'};
      throw error;
    }
  }
  async listFiles(path: string, options?: FileRequest): Promise<FileEntry[]> {
    options?.signal?.throwIfAborted();
    const prefix = await this.prefix();
    const fullPath = path ? `${prefix}/${path}` : prefix;
    const backups = (await this.backups.list(await this.backupScope())).filter((backup) =>
      backup.path.startsWith(`${fullPath}/`)
    );
    options?.signal?.throwIfAborted();
    let entries: FileEntry[];
    try {
      if (!path && prefix === 'proj') {
        const projects: {id: string}[] = await (await this.request('listProj', {}, undefined, options)).json();
        entries = projects.map((project) => ({name: project.id, path: project.id, type: 'folder'}));
      } else {
        const remote: FileEntry[] = await (await this.request('list', {path: fullPath}, undefined, options)).json();
        entries = remote.map((entry) => ({...entry, path: entry.path.slice(prefix.length + 1)}));
      }
      this.listCache.set(path, entries);
    } catch (error) {
      options?.signal?.throwIfAborted();
      if (!backups.length) throw error;
      entries = this.listCache.get(path) ?? [];
    }
    const merged = new Map(entries.map((entry) => [entry.path, entry]));
    for (const backup of backups) {
      const relative = backup.path.slice(prefix.length + 1);
      const child = relative.slice(path ? path.length + 1 : 0).split('/')[0];
      const childPath = path ? `${path}/${child}` : child;
      if (relative === childPath)
        merged.set(childPath, {...merged.get(childPath), ...this.backupEntry(backup, childPath), gitStatus: undefined});
      else if (!merged.has(childPath)) merged.set(childPath, {path: childPath, name: child, type: 'folder'});
    }
    return [...merged.values()];
  }
  private backupEntry(backup: LocalFileBackup, path: string): FileEntry {
    return {
      path,
      name: path.split('/').pop() ?? '',
      type: 'file',
      size: backup.data.byteLength,
      modified: backup.modified,
      localBackup: true,
    };
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    assertWritable(this, path);
    const bytes = await fileBytes(data);
    const fullPath = await this.path(path);
    const scope = options?.backupOnFailure ? await this.backupScope() : undefined;
    let response: Response;
    try {
      response = await this.request('upload', {path: fullPath}, bytes, options);
    } catch (error) {
      if (scope && !options?.signal?.aborted) {
        try {
          await this.backups.put({
            scope,
            path: fullPath,
            data: bytes,
            revision: options.revision ?? undefined,
            modified: Date.now(),
          });
        } catch (backupError) {
          throw new StorageError('Remote save failed and the local backup could not be stored', 'io', {
            cause: new AggregateError([error, backupError]),
          });
        }
        this.changed(path);
      }
      throw error;
    }
    if (scope) await this.backups.delete(scope, fullPath);
    return {revision: this.revision(response)};
  }
  async discardLocalBackup(path: string) {
    await this.backups.delete(await this.backupScope(), await this.path(path));
    this.changed(path);
  }
  private revision(response: Response) {
    const revision = response.headers.get('ETag');
    if (!revision) throw new StorageError('Missing ETag in file response', 'io');
    return revision;
  }
  async createDirectory(path: string, options?: FileRequest) {
    assertWritable(this, path);
    await this.request('mkdir', {path: await this.path(path)}, undefined, options);
  }
  async deleteFile(path: string, options?: FileWriteOptions) {
    assertWritable(this, path);
    await this.request('delete', {path: await this.path(path)}, undefined, options);
  }
}

/** The server selects the current user; local project operations never contact it. */
export class RemoteStorage extends BrowserStorage implements ProjectGit, LocalBackupAccess {
  private readonly projectFiles: RemoteFiles;
  private readonly backups: LocalFileBackups;
  constructor(options: RemoteStorageOptions) {
    const backups = new LocalFileBackups();
    let changed = (_path: string) => {};
    let getUserId: () => Promise<string>;
    const baseURL = options.baseURL.replace(/\/$/, '');
    const backupScope = async () => (typeof indexedDB === 'undefined' ? baseURL : `${baseURL}:${await getUserId()}`);
    const projects = new RemoteFiles(
      options,
      async () => 'proj',
      backups,
      (path) => changed(path),
      backupScope
    );
    let user: Promise<string>;
    let knownUser: string;
    const userKey = `ticlo-file-user:${baseURL}`;
    getUserId = async () => {
      if (knownUser) return knownUser;
      try {
        user ??= projects
          .request('user')
          .then((response) => response.json())
          .then((info: {id: string}) => {
            filePath(info.id);
            if (info.id.includes('/')) throw new StorageError('Invalid user ID', 'invalid-path');
            return info.id;
          });
        knownUser = await user;
        try {
          localStorage.setItem(userKey, knownUser);
        } catch {}
        return knownUser;
      } catch (error) {
        user = undefined;
        if (error instanceof StorageError && error.code !== 'io') throw error;
        try {
          const cached = localStorage.getItem(userKey);
          if (cached) return cached;
        } catch {}
        throw error;
      }
    };
    const files = new RemoteFiles(
      options,
      async () => `usr/${await getUserId()}`,
      backups,
      (path) => changed(path),
      backupScope
    );
    super(projects, files);
    this.projectFiles = projects;
    this.backups = backups;
    changed = (path) => this.fileChanged(path);
  }

  override async close() {
    await Promise.all([super.close(), this.backups.close()]);
  }

  discardLocalBackup(path: string) {
    filePath(path);
    if (path === 'local' || path.startsWith('local/'))
      throw new StorageError('Local project files do not have remote backups', 'invalid-path');
    return this.projectFiles.discardLocalBackup(path);
  }

  async readProject(id: string, options?: FileRequest): Promise<ProjectMetadata> {
    projectId(id);
    if (id === 'local') return super.readProject(id, options);
    return (await this.projectFiles.request('readProj', {id}, undefined, options)).json();
  }
  async createProject(id: string, metadata: Record<string, unknown> = {}): Promise<ProjectMetadata> {
    projectId(id);
    if (id === 'local') return super.createProject(id, metadata);
    try {
      await this.getFileInfo(id);
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
      const created = await (await this.projectFiles.request('createProj', {name: id})).json();
      const value = Object.keys(metadata).length ? await this.updateProject(created.id, metadata) : created;
      this.fileChanged(created.id);
      return value;
    }
    throw new StorageError('Project already exists', 'conflict');
  }
  async updateProject(id: string, metadata: Record<string, unknown>): Promise<ProjectMetadata> {
    projectId(id);
    if (id === 'local') return super.updateProject(id, metadata);
    const previous = await this.readProject(id);
    const value = await (
      await this.projectFiles.request('updateProj', {id}, JSON.stringify({...previous, ...metadata, id}))
    ).json();
    this.fileChanged(`${id}/.proj`);
    return value;
  }
  async deleteProject(id: string) {
    projectId(id);
    if (id === 'local') return super.deleteProject(id);
    await this.projectFiles.request('deleteProj', {id});
    this.fileChanged(id);
  }

  supportsGit(project: string) {
    return project !== 'local';
  }
  private async gitRequest(operation: string, project: string, body?: string, options?: FileRequest) {
    try {
      return await this.projectFiles.request(operation, {id: project}, body, options);
    } catch (error) {
      if (error instanceof StorageError && /Operation requires POST|Unsupported op: git/.test(error.message)) {
        throw new StorageError('This file server does not support Git', 'io', {cause: error});
      }
      throw error;
    }
  }
  async getGitInfo(project: string, options?: FileRequest): Promise<GitInfo> {
    return (await this.gitRequest('gitInfo', project, undefined, options)).json();
  }
  async initGit(project: string, options?: FileRequest): Promise<GitInfo> {
    return (await this.gitRequest('gitInit', project, undefined, options)).json();
  }
  async commitGit(project: string, message: string, options?: FileRequest): Promise<GitCommit> {
    return (await this.gitRequest('gitCommit', project, JSON.stringify({message}), options)).json();
  }
  async getGitHistory(project: string, options?: FileRequest): Promise<GitCommit[]> {
    return (await this.gitRequest('gitHistory', project, undefined, options)).json();
  }
  async restoreGitFile(path: string, options?: FileRequest): Promise<void> {
    filePath(path);
    if (path === 'local' || path.startsWith('local/'))
      throw new StorageError('Git is not available for local files', 'readonly');
    await this.projectFiles.request('gitRestore', {path: `proj/${path}`}, undefined, options);
    this.fileChanged(path);
  }
}
