import {promises as fs} from 'node:fs';
import Path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {ProjectStorage} from '@ticlo/core/storage/ProjectStorage.ts';
import {
  ScopedFiles,
  StorageError,
  assertWritable,
  checkRevision,
  fileBytes,
  filePath,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
} from '@ticlo/core/storage/FileAccess.ts';

/** Projects are direct children of dir; #root is also the current user's directory. */
export class NodeStorage extends ProjectStorage {
  readonly dir: string;
  readonly user: ScopedFiles;
  private readonly mutations = new Map<string, Promise<unknown>>();
  constructor(dir: string) {
    super();
    this.dir = Path.resolve(dir);
    this.user = new ScopedFiles(this, '#root');
  }
  getCapabilities(_path: string) {
    return {write: true, persistent: true};
  }
  private async path(path: string, options: FileRequest = {}) {
    filePath(path, true);
    options.signal?.throwIfAborted();
    const target = Path.resolve(this.dir, path);
    // Reject symlinks inside the root, including a symlink used as a missing file's parent.
    let entry = this.dir;
    for (const part of path.split('/').filter(Boolean)) {
      entry = Path.join(entry, part);
      try {
        if ((await fs.lstat(entry)).isSymbolicLink())
          throw new StorageError('Symlinks are not supported', 'invalid-path');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        break;
      }
    }
    return target;
  }
  private async io<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StorageError || (error as Error).name === 'AbortError') throw error;
      const code = (error as NodeJS.ErrnoException).code;
      throw new StorageError(
        (error as Error).message,
        code === 'ENOENT'
          ? 'not-found'
          : code === 'EEXIST'
            ? 'conflict'
            : code === 'EACCES' || code === 'EPERM'
              ? 'permission-denied'
              : 'io',
        {cause: error}
      );
    }
  }
  private revision(data: Uint8Array) {
    return createHash('sha256').update(data).digest('hex');
  }
  private mutate<T>(path: string, operation: () => Promise<T>) {
    const operationPromise = (this.mutations.get(path) ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.io(operation));
    this.mutations.set(path, operationPromise);
    return operationPromise.finally(() => {
      if (this.mutations.get(path) === operationPromise) this.mutations.delete(path);
    });
  }
  async getFile(path: string, options: FileRequest = {}) {
    return this.io(async () => {
      const data = await fs.readFile(await this.path(path, options), {signal: options.signal});
      return {data: Uint8Array.from(data).buffer, revision: this.revision(data)};
    });
  }
  async getFileInfo(path: string, options?: FileRequest) {
    return this.io(async () => {
      let info: Awaited<ReturnType<typeof fs.stat>>;
      try {
        info = await fs.stat(await this.path(path, options));
      } catch (error) {
        if (path === '#root' && (error as NodeJS.ErrnoException).code === 'ENOENT')
          return {path, name: path, type: 'folder' as const};
        throw error;
      }
      if (!info.isFile() && !info.isDirectory()) throw new StorageError('Unsupported file type', 'invalid-path');
      return {
        path,
        name: path.split('/').pop() ?? '',
        type: info.isDirectory() ? ('folder' as const) : ('file' as const),
        size: info.isFile() ? info.size : undefined,
        created: info.birthtimeMs,
        modified: info.mtimeMs,
      };
    });
  }
  async listFiles(path: string, options?: FileRequest) {
    return this.io(async () => {
      let names: string[];
      try {
        names = await fs.readdir(await this.path(path, options));
      } catch (error) {
        if ((!path || path === '#root') && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
      return Promise.all(
        names
          .filter((name) => !name.startsWith('.') && name !== '_proj.json')
          .map((name) => this.getFileInfo(path ? `${path}/${name}` : name, options))
      );
    });
  }
  async uploadFile(path: string, value: FilePayload, options: FileWriteOptions = {}) {
    assertWritable(this, path);
    const data = new Uint8Array(await fileBytes(value));
    return this.mutate(path, async () => {
      const destination = await this.path(path, options);
      let current: string;
      try {
        current = this.revision(await fs.readFile(destination));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      checkRevision(current, options);
      await fs.mkdir(Path.dirname(destination), {recursive: true});
      const temporary = Path.join(Path.dirname(destination), `.${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, data, {flag: 'wx', signal: options.signal});
        await fs.rename(temporary, destination);
      } finally {
        await fs.rm(temporary, {force: true});
      }
      return {revision: this.revision(data)};
    });
  }
  async createDirectory(path: string, options?: FileRequest) {
    assertWritable(this, path);
    await this.io(async () => {
      await fs.mkdir(await this.path(path, options), {recursive: true});
    });
  }
  async deleteFile(path: string, options: FileWriteOptions = {}) {
    assertWritable(this, path);
    await Promise.all(
      [...this.mutations].filter(([key]) => key.startsWith(`${path}/`)).map(([, operation]) => operation)
    );
    await this.mutate(path, async () => {
      const destination = await this.path(path, options);
      if (options.revision !== undefined) {
        const data = await fs.readFile(destination);
        checkRevision(this.revision(data), options);
      }
      await fs.rm(destination, {recursive: true});
    });
  }
}
