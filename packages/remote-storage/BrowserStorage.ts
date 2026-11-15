import {ProjectStorage} from '@ticlo/core/storage/ProjectStorage.ts';
import type {Root} from '@ticlo/core/block/Flow.ts';
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
import {tryParseFilePath} from '@ticlo/core/storage/FilePath.ts';
import {initBrowserSecretCipher} from './BrowserCipher.ts';
import {BROWSER_LOCAL_LIBRARY, LocalProjectFiles} from './LocalProjectFiles.ts';

const browserLocalPrefix = `${BROWSER_LOCAL_LIBRARY}/`;

export function isBrowserLocalPath(path: string) {
  return path === BROWSER_LOCAL_LIBRARY || path.startsWith(browserLocalPrefix);
}

export abstract class BrowserStorage extends ProjectStorage {
  private readonly local = new LocalProjectFiles();
  private readonly fileChangeListeners = new Set<(path: string) => void>();
  private readonly objectUrls = new Map<string, string>();
  private readonly pendingObjectUrls = new Map<string, Promise<string | undefined>>();
  constructor(
    private readonly remote: FileAccess,
    readonly user: FileAccess
  ) {
    super();
  }
  override async init(root: Root) {
    if (typeof window !== 'undefined') await initBrowserSecretCipher();
    await super.init(root);
  }
  close() {
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.pendingObjectUrls.clear();
    return this.local.close();
  }
  subscribeFileChanges(listener: (path: string) => void) {
    this.fileChangeListeners.add(listener);
    return () => this.fileChangeListeners.delete(listener);
  }
  protected fileChanged(path: string) {
    if (isBrowserLocalPath(path)) {
      const prefix = `${path}/`;
      for (const [key, url] of this.objectUrls) {
        if (key === path || key.startsWith(prefix)) {
          URL.revokeObjectURL(url);
          this.objectUrls.delete(key);
        }
      }
      for (const key of this.pendingObjectUrls.keys()) {
        if (key === path || key.startsWith(prefix)) this.pendingObjectUrls.delete(key);
      }
    }
    for (const listener of this.fileChangeListeners) listener(path);
  }
  notifyFileChange(path: string) {
    this.fileChanged(path);
  }
  private resolveBrowserLocalUrl(storagePath: string): string | Promise<string | undefined> {
    const cached = this.objectUrls.get(storagePath);
    if (cached !== undefined) return cached;
    const pending = this.pendingObjectUrls.get(storagePath);
    if (pending) return pending;
    const relPath = storagePath.slice(browserLocalPrefix.length);
    const request: Promise<string | undefined> = this.local
      .getFile(relPath)
      .then((result: FileReadResult) => {
        if (this.pendingObjectUrls.get(storagePath) !== request) return undefined;
        const url = URL.createObjectURL(new Blob([result.data], {type: result.contentType}));
        this.objectUrls.set(storagePath, url);
        return url;
      })
      .catch((error: unknown): undefined => {
        if (error instanceof StorageError && error.code === 'not-found') return undefined;
        throw error;
      })
      .finally(() => {
        if (this.pendingObjectUrls.get(storagePath) === request) {
          this.pendingObjectUrls.delete(storagePath);
        }
      });
    this.pendingObjectUrls.set(storagePath, request);
    return request;
  }
  protected resolveExternalUrl(path: string, _library?: string): string | undefined | Promise<string | undefined> {
    return path;
  }
  protected resolveProjectFileUrl(_storagePath: string): string | undefined | Promise<string | undefined> {
    return undefined;
  }
  override resolveFilePath(path: string, library?: string): string | undefined | Promise<string | undefined> {
    const parsed = tryParseFilePath(path, library);
    if (!parsed) return undefined;
    switch (parsed.kind) {
      case 'url':
        return parsed.path;
      case 'external':
        return this.resolveExternalUrl(parsed.path, library);
      case 'project':
        return parsed.project === BROWSER_LOCAL_LIBRARY
          ? this.resolveBrowserLocalUrl(parsed.storagePath)
          : this.resolveProjectFileUrl(parsed.storagePath);
    }
  }
  override resolveFileUrl(path: string, library?: string): string | undefined | Promise<string | undefined> {
    return this.resolveFilePath(path, library);
  }
  protected override async readExternalFile(
    path: string,
    library?: string,
    options?: FileRequest
  ): Promise<FileReadResult> {
    const url = await this.resolveFilePath(path, library);
    if (!url) throw new StorageError('External file path is not allowed', 'permission-denied');
    return this.readUrlFile(url, options);
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
