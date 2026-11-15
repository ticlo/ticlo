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
import {Block, type FunctionData} from '@ticlo/core';
import {Library} from '@ticlo/core/block/Library.ts';
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
  type FileReadResult,
  type FileRequest,
  type FileWriteOptions,
  type ProjectGit,
} from '@ticlo/core/storage/FileAccess.ts';
import {
  buildProjectFileUrl,
  classifyFilePath,
  fetchFileResult,
  normalizeLibraryId,
  tryParseFilePath,
} from '@ticlo/core/storage/FilePath.ts';

export type NodeFilePathResolver = (path: string, library?: string) => string | undefined;
export type NodeFileBaseUrl = string | (() => string | undefined);

export interface NodeStorageOptions {
  resolveExternalPath?: NodeFilePathResolver;
  fileBaseUrl?: NodeFileBaseUrl;
  fileUrlScope?: string;
  frontendDir?: string;
  frontendFileBaseUrl?: NodeFileBaseUrl;
  frontendUrlScope?: string;
}

/** Resolve a block function's `file-path` input to a local path via its Root storage. */
export function resolveFilePath(data: FunctionData, path: string): string | undefined | Promise<string | undefined> {
  if (!path || typeof path !== 'string') return undefined;
  const flow = data instanceof Block ? data._flow : undefined;
  const storage = flow ? Library.rootOf(flow)._storage : undefined;
  if (storage?.resolveFilePath) {
    return storage.resolveFilePath(path, flow._library);
  }
  const kind = classifyFilePath(path);
  return kind === 'url' || kind === 'project' || kind === 'relative' || kind === 'frontend' ? undefined : path;
}

/** Projects are direct children of dir; #root is also the current user's directory. */
export class NodeStorage extends ProjectStorage implements ProjectGit {
  readonly dir: string;
  readonly frontendDir?: string;
  readonly user: ScopedFiles;
  private readonly resolveExternalPath?: NodeFilePathResolver;
  private fileBaseUrl?: NodeFileBaseUrl;
  private readonly fileUrlScope: string;
  private frontendFileBaseUrl?: NodeFileBaseUrl;
  private readonly frontendUrlScope: string;
  private readonly mutations = new Map<string, Promise<unknown>>();
  private readonly gitUser = {getUserId: () => 'node'};
  constructor(dir: string, optionsOrResolver?: NodeFilePathResolver | NodeStorageOptions) {
    super();
    this.dir = Path.resolve(dir);
    this.user = new ScopedFiles(this, '#root');
    if (typeof optionsOrResolver === 'function') {
      this.resolveExternalPath = optionsOrResolver;
      this.fileUrlScope = 'proj';
      this.frontendUrlScope = 'proj';
    } else {
      this.resolveExternalPath = optionsOrResolver?.resolveExternalPath;
      this.fileBaseUrl = optionsOrResolver?.fileBaseUrl;
      this.fileUrlScope = optionsOrResolver?.fileUrlScope ?? 'proj';
      this.frontendDir = optionsOrResolver?.frontendDir ? Path.resolve(optionsOrResolver.frontendDir) : undefined;
      this.frontendFileBaseUrl = optionsOrResolver?.frontendFileBaseUrl;
      this.frontendUrlScope = optionsOrResolver?.frontendUrlScope ?? 'proj';
    }
  }
  setFileBaseUrl(fileBaseUrl?: NodeFileBaseUrl) {
    this.fileBaseUrl = fileBaseUrl;
  }
  setFrontendFileBaseUrl(fileBaseUrl?: NodeFileBaseUrl) {
    this.frontendFileBaseUrl = fileBaseUrl;
  }
  override resolveFilePath(path: string, library?: string): string | undefined {
    const parsed = tryParseFilePath(path, library);
    if (!parsed) return undefined;
    switch (parsed.kind) {
      case 'url':
        return undefined;
      case 'external':
        return this.resolveExternalPath?.(parsed.path, normalizeLibraryId(library));
      case 'frontend':
        return this.frontendDir ? Path.resolve(this.frontendDir, parsed.storagePath) : undefined;
      case 'project':
        return Path.resolve(this.dir, parsed.storagePath);
    }
  }
  override resolveFileUrl(path: string, library?: string): string | undefined {
    const parsed = tryParseFilePath(path, library);
    if (!parsed) return undefined;
    switch (parsed.kind) {
      case 'url':
      case 'external':
        return parsed.path;
      case 'frontend': {
        const baseRaw = this.frontendFileBaseUrl ?? (this.frontendDir ? this.fileBaseUrl : undefined);
        const base = typeof baseRaw === 'function' ? baseRaw() : baseRaw;
        return base ? buildProjectFileUrl(base, parsed.storagePath, this.frontendUrlScope) : undefined;
      }
      case 'project': {
        const base = typeof this.fileBaseUrl === 'function' ? this.fileBaseUrl() : this.fileBaseUrl;
        return base ? buildProjectFileUrl(base, parsed.storagePath, this.fileUrlScope) : undefined;
      }
    }
  }
  protected override readUrlFile(url: string, options?: FileRequest): Promise<FileReadResult> {
    return fetchFileResult(url.startsWith('//') ? `https:${url}` : url, options);
  }
  protected override async readFrontendFile(storagePath: string, options: FileRequest = {}): Promise<FileReadResult> {
    if (!this.frontendDir) {
      throw new StorageError('Frontend file storage is not available', 'not-found');
    }
    filePath(storagePath, true);
    options.signal?.throwIfAborted();
    return this.io(async () => {
      const target = Path.resolve(this.frontendDir!, storagePath);
      const data = await fs.readFile(target, {signal: options.signal});
      return {data: Uint8Array.from(data).buffer, revision: this.revision(data)};
    });
  }
  protected override async readExternalFile(
    path: string,
    library?: string,
    options: FileRequest = {}
  ): Promise<FileReadResult> {
    const target = this.resolveExternalPath?.(path, normalizeLibraryId(library));
    if (!target) throw new StorageError('External file path is not allowed', 'permission-denied');
    return this.io(async () => {
      options.signal?.throwIfAborted();
      const data = await fs.readFile(target, {signal: options.signal});
      return {data: Uint8Array.from(data).buffer, revision: this.revision(data)};
    });
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
