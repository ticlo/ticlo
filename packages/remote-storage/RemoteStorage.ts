import {
  FileAccessBase,
  StorageError,
  assertWritable,
  filePath,
  fileBytes,
  type FileEntry,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
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
    const write = !['get', 'list', 'info', 'listProj', 'readProj', 'user'].includes(operation);
    if (body !== undefined) headers.set('Content-Type', 'application/octet-stream');
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
export class RemoteStorage extends BrowserStorage {
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
  }
}
