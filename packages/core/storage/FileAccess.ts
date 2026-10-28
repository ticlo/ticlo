/** File paths are relative to the access scope; project storage starts with a project ID. */
export interface FileEntry {
  path: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  created?: number;
  modified?: number;
}
export interface FileRequest {
  signal?: AbortSignal;
}
export interface FileWriteOptions extends FileRequest {
  existsBehavior?: 'fail' | 'overwrite';
  /** null means the file must not exist. */
  revision?: string | null;
}
export interface FileReadResult {
  data: ArrayBuffer;
  revision?: string;
  contentType?: string;
}
export interface FileWriteResult {
  revision?: string;
}
export type FilePayload = string | Uint8Array | ArrayBuffer | Blob;
export interface StorageCapabilities {
  write: boolean;
  persistent: boolean;
}
export interface ProjectMetadata extends Record<string, unknown> {
  id: string;
}
export interface FileAccess {
  getCapabilities(path: string): StorageCapabilities;
  getFile(path: string, options?: FileRequest): Promise<FileReadResult>;
  getFileInfo(path: string, options?: FileRequest): Promise<FileEntry>;
  listFiles(path: string, options?: FileRequest): Promise<FileEntry[]>;
  uploadFile(path: string, data: FilePayload, options?: FileWriteOptions): Promise<FileWriteResult>;
  createDirectory(path: string, options?: FileRequest): Promise<void>;
  deleteFile(path: string, options?: FileWriteOptions): Promise<void>;
  copyFile(source: string, destination: string, options?: FileRequest): Promise<void>;
  moveFile(source: string, destination: string, options?: FileRequest): Promise<void>;
  renameFile(path: string, name: string, options?: FileRequest): Promise<void>;
}
export interface ProjectFiles extends FileAccess {
  readonly user: FileAccess;
  listProjects(options?: FileRequest): Promise<ProjectMetadata[]>;
  readProject(id: string, options?: FileRequest): Promise<ProjectMetadata>;
  createProject(id: string, metadata?: Record<string, unknown>): Promise<ProjectMetadata>;
  updateProject(id: string, metadata: Record<string, unknown>): Promise<ProjectMetadata>;
  deleteProject(id: string): Promise<void>;
}
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'not-found' | 'conflict' | 'readonly' | 'permission-denied' | 'invalid-path' | 'io',
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'StorageError';
  }
}
export function filePath(path: string, allowRoot = false): string {
  if (
    typeof path !== 'string' ||
    (!path && !allowRoot) ||
    path.includes('\\') ||
    path.includes('\0') ||
    (path && path.split('/').some((part) => !part || part === '.' || part === '..' || part !== part.trim()))
  ) {
    throw new StorageError('Invalid file path', 'invalid-path');
  }
  return path;
}
export function projectId(id: string): string {
  filePath(id);
  if (id.includes('/') || id.includes('.')) throw new StorageError('Invalid project ID', 'invalid-path');
  return id;
}
export async function fileBytes(data: FilePayload): Promise<ArrayBuffer> {
  if (typeof data === 'string') return new TextEncoder().encode(data).buffer;
  if (data instanceof Blob) return data.arrayBuffer();
  if (data instanceof Uint8Array) return new Uint8Array(data).buffer;
  return data.slice(0);
}
export function assertWritable(files: FileAccess, path: string) {
  filePath(path);
  if (!files.getCapabilities(path).write) throw new StorageError('Storage is read-only', 'readonly');
}
export function checkRevision(current: string | undefined, options: FileWriteOptions = {}) {
  if (
    (options.existsBehavior === 'fail' && current !== undefined) ||
    (options.revision === null && current !== undefined) ||
    (typeof options.revision === 'string' && current !== options.revision)
  ) {
    throw new StorageError('File changed; reload before saving', 'conflict');
  }
}

/** Common recursive operations also work across browser-local and remote projects. */
export abstract class FileAccessBase implements FileAccess {
  abstract getCapabilities(path: string): StorageCapabilities;
  abstract getFile(path: string, options?: FileRequest): Promise<FileReadResult>;
  abstract getFileInfo(path: string, options?: FileRequest): Promise<FileEntry>;
  abstract listFiles(path: string, options?: FileRequest): Promise<FileEntry[]>;
  abstract uploadFile(path: string, data: FilePayload, options?: FileWriteOptions): Promise<FileWriteResult>;
  abstract createDirectory(path: string, options?: FileRequest): Promise<void>;
  abstract deleteFile(path: string, options?: FileWriteOptions): Promise<void>;

  async copyFile(source: string, destination: string, options: FileRequest = {}) {
    filePath(source);
    assertWritable(this, destination);
    if (source === destination || destination.startsWith(`${source}/`) || source.startsWith(`${destination}/`)) {
      throw new StorageError('Cannot copy an entry into itself', 'invalid-path');
    }
    const entry = await this.getFileInfo(source, options);
    options.signal?.throwIfAborted();
    if (entry.type === 'folder') {
      // Do not merge silently into an existing destination directory.
      try {
        await this.getFileInfo(destination, options);
      } catch (error) {
        if (!(error instanceof StorageError) || error.code !== 'not-found') throw error;
        await this.createDirectory(destination, options);
        for (const child of await this.listFiles(source, options))
          await this.copyFile(child.path, `${destination}/${child.name}`, options);
        return;
      }
      throw new StorageError('Destination already exists', 'conflict');
    }
    const value = await this.getFile(source, options);
    await this.uploadFile(destination, value.data, {...options, existsBehavior: 'fail'});
  }
  async moveFile(source: string, destination: string, options: FileRequest = {}) {
    assertWritable(this, source);
    assertWritable(this, destination);
    if (source === destination || destination.startsWith(`${source}/`) || source.startsWith(`${destination}/`))
      throw new StorageError('Cannot move an entry into itself', 'invalid-path');
    if ((await this.getFileInfo(source, options)).type === 'file') {
      const value = await this.getFile(source, options);
      await this.uploadFile(destination, value.data, {...options, existsBehavior: 'fail'});
      await this.deleteFile(source, {...options, revision: value.revision});
      return;
    }
    await this.copyFile(source, destination, options);
    await this.deleteFile(source, options);
  }
  async renameFile(path: string, name: string, options?: FileRequest) {
    filePath(name);
    if (name.includes('/')) throw new StorageError('Invalid file name', 'invalid-path');
    return this.moveFile(path, `${path.slice(0, path.lastIndexOf('/') + 1)}${name}`, options);
  }
}

export class ScopedFiles extends FileAccessBase {
  constructor(
    private readonly files: FileAccess,
    private readonly prefix: string
  ) {
    super();
    filePath(prefix);
  }
  private path(path: string) {
    filePath(path, true);
    return path ? `${this.prefix}/${path}` : this.prefix;
  }
  getCapabilities(path: string) {
    return this.files.getCapabilities(this.path(path));
  }
  async getFile(path: string, options?: FileRequest) {
    return this.files.getFile(this.path(path), options);
  }
  async getFileInfo(path: string, options?: FileRequest) {
    const entry = await this.files.getFileInfo(this.path(path), options);
    return {...entry, path};
  }
  async listFiles(path: string, options?: FileRequest) {
    return (await this.files.listFiles(this.path(path), options)).map((entry) => ({
      ...entry,
      path: entry.path.slice(this.prefix.length + 1),
    }));
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    return this.files.uploadFile(this.path(path), data, options);
  }
  async createDirectory(path: string, options?: FileRequest) {
    return this.files.createDirectory(this.path(path), options);
  }
  async deleteFile(path: string, options?: FileWriteOptions) {
    return this.files.deleteFile(this.path(path), options);
  }
}
