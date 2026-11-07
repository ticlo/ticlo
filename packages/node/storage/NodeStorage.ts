import {promises as fs} from 'node:fs';
import Path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {
  commitGit,
  deleteGitBranch,
  gitBranches,
  gitHistory,
  gitInfo,
  gitStatus,
  initGit,
  resetGitToCommit,
  restoreGitFile,
  statusForPath,
  withCommitWorktree,
} from '@ticlo/node-git/gitOperations.ts';
import {GitError} from '@ticlo/node-git/GitError.ts';
import {ProjectStorage} from '@ticlo/core/storage/ProjectStorage.ts';
import {
  ScopedFiles,
  StorageError,
  assertWritable,
  checkRevision,
  fileBytes,
  filePath,
  projectId,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
  type ProjectGit,
} from '@ticlo/core/storage/FileAccess.ts';

/** Projects are direct children of dir; #root is also the current user's directory. */
export class NodeStorage extends ProjectStorage implements ProjectGit {
  readonly dir: string;
  readonly user: ScopedFiles;
  private readonly mutations = new Map<string, Promise<unknown>>();
  private readonly gitUser = {getUserId: () => 'node'};
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
      if (error instanceof GitError) {
        throw new StorageError(
          error.message,
          error.statusCode === 400
            ? 'invalid-path'
            : error.statusCode === 403
              ? 'permission-denied'
              : error.statusCode === 404
                ? 'not-found'
                : error.statusCode === 409
                  ? 'conflict'
                  : 'io',
          {cause: error}
        );
      }
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
      const fullPath = await this.path(path, options);
      const [project, ...relativeParts] = path.split('/');
      const relative = relativeParts.join('/');
      const statuses = path ? await gitStatus(Path.join(this.dir, project)) : undefined;
      let info: Awaited<ReturnType<typeof fs.stat>>;
      try {
        info = await fs.stat(fullPath);
      } catch (error) {
        if (path === '#root' && (error as NodeJS.ErrnoException).code === 'ENOENT')
          return {path, name: path, type: 'folder' as const};
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && statuses) {
          const status = statusForPath(statuses, relative);
          if (status === 'deleted') {
            const folder = [...statuses.keys()].some((name) => name.startsWith(`${relative}/`));
            return {
              path,
              name: Path.basename(path),
              type: folder ? ('folder' as const) : ('file' as const),
              size: folder ? undefined : 0,
              gitStatus: status,
            };
          }
        }
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
        gitStatus: statuses ? statusForPath(statuses, relative) : undefined,
      };
    });
  }
  async listFiles(path: string, options?: FileRequest) {
    return this.io(async () => {
      const directory = await this.path(path, options);
      const [project, ...relativeParts] = path.split('/');
      const relative = relativeParts.join('/');
      const statuses = path ? await gitStatus(Path.join(this.dir, project)) : new Map();
      let names: string[];
      try {
        names = await fs.readdir(directory);
      } catch (error) {
        if ((!path || path === '#root') && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        if (
          (error as NodeJS.ErrnoException).code === 'ENOENT' &&
          relative &&
          statusForPath(statuses, relative) === 'deleted'
        )
          names = [];
        else throw error;
      }
      const results = await Promise.all(
        names
          .filter((name) => !name.startsWith('.'))
          .map(async (name) => {
            const childPath = path ? `${path}/${name}` : name;
            const info = await fs.stat(await this.path(childPath, options));
            const childRelative = relative ? `${relative}/${name}` : name;
            return {
              path: childPath,
              name,
              type: info.isDirectory() ? ('folder' as const) : ('file' as const),
              size: info.isFile() ? info.size : undefined,
              created: info.birthtimeMs,
              modified: info.mtimeMs,
              gitStatus: path ? statusForPath(statuses, childRelative) : undefined,
            };
          })
      );
      if (path) {
        const prefix = relative ? `${relative}/` : '';
        for (const [filename, status] of statuses) {
          if (status !== 'deleted' || !filename.startsWith(prefix)) continue;
          const rest = filename.slice(prefix.length);
          const name = rest.split('/')[0];
          if (!name || name.startsWith('.') || results.some((entry) => entry.name === name)) continue;
          const folder = rest.includes('/');
          results.push({
            path: `${path}/${name}`,
            name,
            type: folder ? 'folder' : 'file',
            size: folder ? undefined : 0,
            created: 0,
            modified: 0,
            gitStatus: 'deleted',
          });
        }
      }
      return results;
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

  supportsGit(_project: string) {
    return true;
  }
  private async gitRoot(project: string, options?: FileRequest) {
    projectId(project);
    const root = await this.path(project, options);
    if (!(await fs.stat(root)).isDirectory()) throw new StorageError('Project not found', 'not-found');
    return root;
  }
  async getGitInfo(project: string, options?: FileRequest) {
    return this.io(async () => gitInfo(await this.gitRoot(project, options)));
  }
  async initGit(project: string, options?: FileRequest) {
    return this.io(async () => {
      const root = await this.gitRoot(project, options);
      await initGit(root);
      return gitInfo(root);
    });
  }
  async commitGit(project: string, message: string, options?: FileRequest) {
    return this.io(async () => {
      const root = await this.gitRoot(project, options);
      await Promise.all(
        [...this.mutations].filter(([path]) => path.startsWith(`${project}/`)).map(([, pending]) => pending)
      );
      return commitGit(root, this.gitUser, message);
    });
  }
  async getGitBranches(project: string, options?: FileRequest) {
    return this.io(async () => gitBranches(await this.gitRoot(project, options)));
  }
  async deleteGitBranch(project: string, branch: string, options?: FileRequest) {
    return this.io(async () => deleteGitBranch(await this.gitRoot(project, options), branch));
  }
  async getGitHistory(project: string, options?: FileRequest & {branch?: string}) {
    return this.io(async () => gitHistory(await this.gitRoot(project, options), options?.branch));
  }
  async resetGitToCommit(project: string, commit: string, options?: FileRequest) {
    return this.io(async () => ({backupBranch: await resetGitToCommit(await this.gitRoot(project, options), commit)}));
  }
  async createProjectFromCommit(project: string, name: string, commit: string, options?: FileRequest) {
    return this.io(async () => {
      const source = await this.gitRoot(project, options);
      projectId(name);
      const destination = await this.path(name, options);
      try {
        await fs.stat(destination);
        throw new StorageError('Project already exists', 'conflict');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await withCommitWorktree(source, commit, async (directory) => {
        try {
          await fs.cp(directory, destination, {
            recursive: true,
            filter: (entry) => !['.git', '.gitignore', '.gitlog', '.gitkeep'].includes(Path.basename(entry)),
          });
          await this.updateProject(name, {});
        } catch (error) {
          await fs.rm(destination, {recursive: true, force: true});
          throw error;
        }
      });
      return this.readProject(name);
    });
  }
  async restoreGitFile(path: string, options?: FileRequest) {
    return this.io(async () => {
      filePath(path);
      const [project, ...relative] = path.split('/');
      if (!relative.length || relative.some((part) => ['.git', '.gitignore', '.gitlog', '.proj'].includes(part)))
        throw new StorageError('Project file is required', 'invalid-path');
      await restoreGitFile(await this.gitRoot(project, options), relative.join('/'));
    });
  }
}
