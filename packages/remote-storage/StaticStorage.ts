import {
  FileAccessBase,
  StorageError,
  filePath,
  type FileEntry,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
} from '@ticlo/core/storage/FileAccess.ts';
import {BrowserStorage} from './BrowserStorage.ts';

class StaticFiles extends FileAccessBase {
  constructor(private readonly baseURL: string) {
    super();
  }
  getCapabilities(_path: string) {
    return {write: false, persistent: false};
  }
  private url(path: string) {
    filePath(path, true);
    return `${this.baseURL.replace(/\/$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  private async read(path: string, options: FileRequest = {}) {
    const response = await fetch(this.url(path), {signal: options.signal});
    if (!response.ok) throw new StorageError(`HTTP ${response.status}`, response.status === 404 ? 'not-found' : 'io');
    return response;
  }
  async getFile(path: string, options?: FileRequest) {
    const response = await this.read(path, options);
    return {
      data: await response.arrayBuffer(),
      revision: response.headers.get('ETag') ?? undefined,
      contentType: response.headers.get('Content-Type') ?? undefined,
    };
  }
  async listFiles(path: string, options?: FileRequest): Promise<FileEntry[]> {
    const data: unknown = await (await this.read(path ? `${path}/.list.json` : '.list.json', options)).json();
    if (!Array.isArray(data)) throw new StorageError('Invalid directory index', 'io');
    return data.map((item: unknown) => {
      if (typeof item !== 'string') throw new StorageError('Invalid directory entry', 'io');
      const folder = item.endsWith('/');
      const name = folder ? item.slice(0, -1) : item;
      filePath(name);
      if (name.includes('/')) throw new StorageError('Invalid directory entry', 'invalid-path');
      return {name, path: path ? `${path}/${name}` : name, type: folder ? 'folder' : 'file'};
    });
  }
  async getFileInfo(path: string, options?: FileRequest): Promise<FileEntry> {
    filePath(path, true);
    if (!path) {
      await this.listFiles('', options);
      return {path: '', name: '', type: 'folder'};
    }
    const parent = path.slice(0, path.lastIndexOf('/') + 1).replace(/\/$/, '');
    const entry = (await this.listFiles(parent, options)).find((entry) => entry.path === path);
    if (!entry) throw new StorageError('File not found', 'not-found');
    return entry;
  }
  async uploadFile(_path: string, _data: FilePayload, _options?: FileWriteOptions): Promise<never> {
    throw new StorageError('Static files are read-only', 'readonly');
  }
  async createDirectory(_path: string, _options?: FileRequest): Promise<never> {
    throw new StorageError('Static files are read-only', 'readonly');
  }
  async deleteFile(_path: string, _options?: FileWriteOptions): Promise<never> {
    throw new StorageError('Static files are read-only', 'readonly');
  }
}

/** Static projects and the guest user are read-only; only local is persisted. */
export class StaticStorage extends BrowserStorage {
  constructor(baseURL: string) {
    super(
      new StaticFiles(`${baseURL.replace(/\/$/, '')}/proj`),
      new StaticFiles(`${baseURL.replace(/\/$/, '')}/usr/guest`)
    );
  }
}
