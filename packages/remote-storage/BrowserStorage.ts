import {ProjectStorage} from '@ticlo/core/storage/ProjectStorage.ts';
import {
  StorageError,
  filePath,
  projectId,
  type FileAccess,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
} from '@ticlo/core/storage/FileAccess.ts';
import {LocalProjectFiles} from './LocalProjectFiles.ts';

export abstract class BrowserStorage extends ProjectStorage {
  private readonly local = new LocalProjectFiles();
  constructor(
    private readonly remote: FileAccess,
    readonly user: FileAccess
  ) {
    super();
  }
  close() {
    return this.local.close();
  }
  private route(path: string) {
    filePath(path, true);
    if (path === 'local' || path.startsWith('local/')) return {files: this.local, path: path.slice(6)};
    if (path) projectId(path.split('/')[0]);
    return {files: this.remote, path};
  }
  getCapabilities(path: string) {
    const target = this.route(path);
    return target.files.getCapabilities(target.path);
  }
  async getFile(path: string, options?: FileRequest) {
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
        ...entries.filter((entry) => entry.name !== 'local'),
        {type: 'folder' as const, path: 'local', name: 'local'},
      ];
    return target.files === this.local ? entries.map((entry) => ({...entry, path: `local/${entry.path}`})) : entries;
  }
  async uploadFile(path: string, data: FilePayload, options?: FileWriteOptions) {
    const target = this.route(path);
    return target.files.uploadFile(target.path, data, options);
  }
  async createDirectory(path: string, options?: FileRequest) {
    const target = this.route(path);
    return target.files.createDirectory(target.path, options);
  }
  async deleteFile(path: string, options?: FileWriteOptions) {
    if (path === 'local')
      return Promise.reject(new StorageError('The local project cannot be deleted', 'permission-denied'));
    const target = this.route(path);
    return target.files.deleteFile(target.path, options);
  }
  async readProject(id: string, options?: FileRequest) {
    return {...(id === 'local' ? {name: 'Local'} : {}), ...(await super.readProject(id, options))};
  }
  async moveFile(source: string, destination: string, options?: FileRequest) {
    if (source === 'local') throw new StorageError('The local project cannot be moved', 'permission-denied');
    await super.moveFile(source, destination, options);
  }
}
