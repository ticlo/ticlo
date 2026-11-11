import {ProjectStorage} from '@ticlo/core/storage/ProjectStorage.ts';
import {
  StorageError,
  filePath,
  projectId,
  type FileAccess,
  type FilePayload,
  type FileReadResult,
  type FileRequest,
  type FileWriteOptions,
} from '@ticlo/core/storage/FileAccess.ts';
import {BROWSER_LOCAL_LIBRARY, LocalProjectFiles} from './LocalProjectFiles.ts';

const browserLocalPrefix = `${BROWSER_LOCAL_LIBRARY}/`;

export function isBrowserLocalPath(path: string) {
  return path === BROWSER_LOCAL_LIBRARY || path.startsWith(browserLocalPrefix);
}

export abstract class BrowserStorage extends ProjectStorage {
  private readonly local = new LocalProjectFiles();
  private readonly fileChangeListeners = new Set<(path: string) => void>();
  constructor(
    private readonly remote: FileAccess,
    readonly user: FileAccess
  ) {
    super();
  }
  close() {
    return this.local.close();
  }
  subscribeFileChanges(listener: (path: string) => void) {
    this.fileChangeListeners.add(listener);
    return () => this.fileChangeListeners.delete(listener);
  }
  protected fileChanged(path: string) {
    for (const listener of this.fileChangeListeners) listener(path);
  }
  notifyFileChange(path: string) {
    this.fileChanged(path);
  }
  private route(path: string) {
    filePath(path, true);
    if (isBrowserLocalPath(path)) return {files: this.local, path: path.slice(browserLocalPrefix.length)};
    if (path) projectId(path.split('/')[0]);
    return {files: this.remote, path};
  }
  getCapabilities(path: string) {
    const target = this.route(path);
    return target.files.getCapabilities(target.path);
  }
  async getFile(path: string, options?: FileRequest): Promise<FileReadResult> {
    const target = this.route(path);
    return target.files.getFile(target.path, options);
  }
  async getFileInfo(path: string, options?: FileRequest) {
    const target = this.route(path);
    return {...(await target.files.getFileInfo(target.path, options)), path, name: path.split('/').pop()};
  }
  async listFiles(path: string, options?: FileRequest) {
    const target = this.route(path);
    const entries = await target.files.listFiles(target.path, options);
    if (!path)
      return [
        ...entries.filter((entry) => entry.name !== BROWSER_LOCAL_LIBRARY),
        {type: 'folder' as const, path: BROWSER_LOCAL_LIBRARY, name: BROWSER_LOCAL_LIBRARY},
      ];
    return target.files === this.local
      ? entries.map((entry) => ({...entry, path: `${browserLocalPrefix}${entry.path}`}))
      : entries;
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    const target = this.route(path);
    const result = await target.files.uploadFile(target.path, data, options);
    this.fileChanged(path);
    return result;
  }
  async createDirectory(path: string, options?: FileRequest) {
    const target = this.route(path);
    await target.files.createDirectory(target.path, options);
    this.fileChanged(path);
  }
  async deleteFile(path: string, options?: FileWriteOptions) {
    if (path === BROWSER_LOCAL_LIBRARY)
      return Promise.reject(new StorageError('BrowserLocal cannot be deleted', 'permission-denied'));
    const target = this.route(path);
    await target.files.deleteFile(target.path, options);
    this.fileChanged(path);
  }
  async readProject(id: string, options?: FileRequest) {
    return {
      ...(id === BROWSER_LOCAL_LIBRARY ? {name: BROWSER_LOCAL_LIBRARY} : {}),
      ...(await super.readProject(id, options)),
    };
  }
  async moveFile(source: string, destination: string, options?: FileRequest) {
    if (source === BROWSER_LOCAL_LIBRARY) throw new StorageError('BrowserLocal cannot be moved', 'permission-denied');
    await super.moveFile(source, destination, options);
  }
}
