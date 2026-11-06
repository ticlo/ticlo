import {TicloFileClient} from './TicloFileClient.ts';
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
  type GitCommit,
  type GitInfo,
  type ProjectGit,
} from '@ticlo/core/storage/FileAccess.ts';
import {BrowserStorage} from './BrowserStorage.ts';

export interface RemoteStorageOptions {
  baseURL: string;
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

function requestOptions(options: FileWriteOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.revision === null) headers['If-None-Match'] = '*';
  else if (options.revision !== undefined) headers['If-Match'] = options.revision;
  return {signal: options.signal, headers};
}

async function withStorageErrors<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    const response = (error as {response?: {status: number; data: unknown}})?.response;
    if (!response) throw error;
    let body = response.data;
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      body = new TextDecoder().decode(body);
    }
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // Keep the response text as the error message.
      }
    }
    const message =
      (typeof body === 'object' && body && 'message' in body && String(body.message)) ||
      (typeof body === 'string' && body) ||
      `HTTP ${response.status}`;
    throw new StorageError(
      message,
      response.status === 404
        ? 'not-found'
        : response.status === 409 || response.status === 412
          ? 'conflict'
          : response.status === 401 || response.status === 403
            ? 'permission-denied'
            : 'io',
      {cause: error}
    );
  }
}

class RemoteFiles extends FileAccessBase {
  constructor(
    private readonly client: TicloFileClient,
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
  async getFile(path: string, options?: FileRequest) {
    const response = await withStorageErrors(this.client.getFile(await this.path(path), requestOptions(options)));
    return {
      data: new Uint8Array(response.data).slice().buffer,
      revision: this.revision(response.headers),
      contentType: response.headers['content-type'] ? String(response.headers['content-type']) : undefined,
    };
  }
  async getFileInfo(path: string, options?: FileRequest): Promise<FileEntry> {
    return {
      ...(await withStorageErrors(this.client.getFileInfo(await this.path(path), requestOptions(options)))),
      path,
    };
  }
  async listFiles(path: string, options?: FileRequest): Promise<FileEntry[]> {
    const prefix = await this.prefix();
    if (!path && prefix === 'proj') {
      const projects = await withStorageErrors(this.client.listProjects(requestOptions(options)));
      return projects.map((project) => ({name: project.id, path: project.id, type: 'folder'}));
    }
    const entries = await withStorageErrors(this.client.listFiles(await this.path(path), requestOptions(options)));
    return entries.map((entry) => ({...entry, path: entry.path.slice(prefix.length + 1)}));
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    assertWritable(this, path);
    const response = await withStorageErrors(
      this.client.uploadFileResponse(
        await this.path(path),
        new Uint8Array(await fileBytes(data)),
        {existsBehavior: options?.existsBehavior},
        requestOptions(options)
      )
    );
    return {revision: this.revision(response.headers)};
  }
  private revision(headers: unknown) {
    const revision = (headers as {etag?: unknown})?.etag;
    if (!revision) throw new StorageError('Missing ETag in file response', 'io');
    return String(revision);
  }
  async createDirectory(path: string, options?: FileRequest) {
    assertWritable(this, path);
    await withStorageErrors(this.client.createDirectory(await this.path(path), requestOptions(options)));
  }
  async deleteFile(path: string, options?: FileWriteOptions) {
    assertWritable(this, path);
    await withStorageErrors(this.client.deleteFile(await this.path(path), requestOptions(options)));
  }
}

/** The server selects the current user; local project operations never contact it. */
export class RemoteStorage extends BrowserStorage implements ProjectGit {
  private readonly client: TicloFileClient;
  constructor(options: RemoteStorageOptions) {
    const client = new TicloFileClient({
      baseURL: options.baseURL,
      headers: Object.fromEntries(new Headers(options.headers)),
      ...(options.credentials === 'include' ? {withCredentials: true} : {}),
      ...(options.credentials === 'omit' ? {withCredentials: false} : {}),
      ...(options.fetch ? {adapter: 'fetch', env: {fetch: options.fetch}} : {}),
    });
    const projects = new RemoteFiles(client, async () => 'proj');
    let user: Promise<string>;
    const files = new RemoteFiles(client, async () => {
      user ??= withStorageErrors(client.getCurrentUser()).then((info) => {
        filePath(info.id);
        if (info.id.includes('/')) throw new StorageError('Invalid user ID', 'invalid-path');
        return info.id;
      });
      return `usr/${await user}`;
    });
    super(projects, files);
    this.client = client;
  }

  supportsGit(project: string) {
    return project !== 'local';
  }
  private async gitRequest<T>(request: Promise<T>): Promise<T> {
    try {
      return await withStorageErrors(request);
    } catch (error) {
      if (error instanceof StorageError && /Operation requires POST|Unsupported op: git/.test(error.message)) {
        throw new StorageError('This file server does not support Git', 'io', {cause: error});
      }
      throw error;
    }
  }
  async getGitInfo(project: string, options?: FileRequest): Promise<GitInfo> {
    return this.gitRequest(this.client.getGitInfo(project, requestOptions(options)));
  }
  async initGit(project: string, options?: FileRequest): Promise<GitInfo> {
    return this.gitRequest(this.client.initGit(project, requestOptions(options)));
  }
  async commitGit(project: string, message: string, options?: FileRequest): Promise<GitCommit> {
    return this.gitRequest(this.client.commitGit(project, message, requestOptions(options)));
  }
  async getGitHistory(project: string, options?: FileRequest): Promise<GitCommit[]> {
    return this.gitRequest(this.client.getGitHistory(project, requestOptions(options)));
  }
}
