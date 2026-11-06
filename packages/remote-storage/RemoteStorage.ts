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
  type ProjectGit,
  type ProjectMetadata,
} from '@ticlo/core/storage/FileAccess.ts';
import {BrowserStorage} from './BrowserStorage.ts';

export interface RemoteStorageOptions {
  baseURL: string;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}
class RemoteFiles extends FileAccessBase {
  constructor(
    private readonly options: RemoteStorageOptions,
    private readonly prefix: () => Promise<string>
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
    const response = await this.request('get', {path: await this.path(path)}, undefined, options);
    return {
      data: await response.arrayBuffer(),
      revision: this.revision(response),
      contentType: response.headers.get('Content-Type') ?? undefined,
    };
  }
  async getFileInfo(path: string, options?: FileRequest): Promise<FileEntry> {
    const response = await this.request('info', {path: await this.path(path)}, undefined, options);
    return {...(await response.json()), path};
  }
  async listFiles(path: string, options?: FileRequest): Promise<FileEntry[]> {
    if (!path && (await this.prefix()) === 'proj') {
      const projects: {id: string}[] = await (await this.request('listProj', {}, undefined, options)).json();
      return projects.map((project) => ({name: project.id, path: project.id, type: 'folder'}));
    }
    const prefix = await this.prefix();
    const entries: FileEntry[] = await (
      await this.request('list', {path: await this.path(path)}, undefined, options)
    ).json();
    return entries.map((entry) => ({...entry, path: entry.path.slice(prefix.length + 1)}));
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    assertWritable(this, path);
    const response = await this.request('upload', {path: await this.path(path)}, await fileBytes(data), options);
    return {revision: this.revision(response)};
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
export class RemoteStorage extends BrowserStorage implements ProjectGit {
  private readonly projectFiles: RemoteFiles;
  constructor(options: RemoteStorageOptions) {
    const projects = new RemoteFiles(options, async () => 'proj');
    let user: Promise<string>;
    const files = new RemoteFiles(options, async () => {
      user ??= projects
        .request('user')
        .then((response) => response.json())
        .then((info: {id: string}) => {
          filePath(info.id);
          if (info.id.includes('/')) throw new StorageError('Invalid user ID', 'invalid-path');
          return info.id;
        });
      return `usr/${await user}`;
    });
    super(projects, files);
    this.projectFiles = projects;
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
