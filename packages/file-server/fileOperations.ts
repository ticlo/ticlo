import {randomUUID} from 'node:crypto';
import {constants as fsConstants, promises as fs, type Dirent} from 'node:fs';
import path from 'node:path';
import type {UserAuth} from './auth.ts';
import {lookUpMimeType} from './mimeTypes.ts';
import {gitStatus, logChange, restoreGitFile, statusForPath, type GitStatus} from './gitOperations.ts';
import {buildEtag, handleErrors, normalizeInput, toPosix, type HonoReply, type StorageLogger} from './utils.ts';
import {AuthProvider, FileQuerystring, StorageContext, StorageError, StoragePath, StorageScope} from './types.ts';

const {stat, lstat, readdir, mkdir, access, rename, rm, copyFile, writeFile, readFile} = fs;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      if ((c & 1) === 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[i] = c >>> 0;
  }
  return table;
})();

interface FileRouteContext {
  rootDir: string;
  authProvider: AuthProvider;
  logger: StorageLogger;
}

function buildStoragePath(rawPath: string, baseDir: string): StoragePath {
  const normalized = normalizeInput(rawPath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new StorageError('Path must include scope and identifier', 400);
  }
  const [rawScope, id, ...rest] = segments;
  if (rawScope !== 'proj' && rawScope !== 'usr') {
    throw new StorageError('Unsupported storage scope', 400);
  }
  const scope = rawScope as StorageScope;
  if (scope === 'proj' && id.includes('.')) {
    throw new StorageError('Project id cannot contain dots', 400);
  }
  if (
    scope === 'proj' &&
    (id === 'HEAD' || id.includes('@{') || id.startsWith('-') || /[\u0000-\u0020\u007f~^:?*[\\]/.test(id))
  ) {
    throw new StorageError('Invalid project id', 400);
  }
  if (!id) {
    throw new StorageError('Identifier segment is required', 400);
  }

  const projectRoot = path.resolve(baseDir, path.join(scope, id));
  const relativePath = rest.length > 0 ? path.join(...rest) : '';
  const absolute = relativePath ? path.resolve(projectRoot, relativePath) : projectRoot;

  const rootRelative = path.relative(baseDir, absolute);
  if (rootRelative.startsWith('..') || path.isAbsolute(rootRelative)) {
    throw new StorageError('Resolved path escapes storage root', 400);
  }

  const posixPath = toPosix([scope, id, ...rest]);

  if (rest.includes('.git')) throw new StorageError('Git internals are not accessible', 403);

  return {
    scope,
    id,
    relative: rest.join('/'),
    absolute,
    projectRoot,
    posixPath,
  };
}

function ensureMutable(storage: StoragePath, allowRoot = false): void {
  if (
    (!allowRoot && !storage.relative) ||
    storage.relative.split('/').some((part) => ['.git', '.gitlog', '.gitignore', '.proj'].includes(part))
  ) {
    throw new StorageError('Protected path', 403);
  }
}

async function ensureNoSymlink(storage: StoragePath, rootDir: string): Promise<void> {
  let current = rootDir;
  for (const segment of path.relative(rootDir, storage.absolute).split(path.sep)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new StorageError('Symlinks are not supported', 403);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

async function logFileChange(
  storage: StoragePath,
  auth: UserAuth,
  action: string,
  destination?: StoragePath
): Promise<void> {
  if (storage.scope === 'proj')
    await logChange(storage.projectRoot, auth, action, storage.relative, destination?.relative);
}

async function resolveAuth(provider: AuthProvider, request: StorageContext): Promise<UserAuth> {
  const auth = await provider(request);
  if (!auth) {
    throw new StorageError('Authorization provider returned no auth context', 500);
  }
  return auth;
}

async function ensureRead(auth: UserAuth, projectId: string): Promise<void> {
  const allowed = await auth.canRead(projectId);
  if (!allowed) {
    throw new StorageError('Forbidden', 403);
  }
}

async function ensureWrite(auth: UserAuth, projectId: string): Promise<void> {
  const allowed = await auth.canWrite(projectId);
  if (!allowed) {
    throw new StorageError('Forbidden', 403);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function crc32(buffer: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

async function streamToBuffer(request: StorageContext): Promise<Buffer> {
  return Buffer.from(await request.req.arrayBuffer());
}

const CACHE_CONTROL_HEADER = 'max-age=0, must-revalidate';

async function sendFileReply(request: StorageContext, reply: HonoReply, storage: StoragePath) {
  const content = await readFile(storage.absolute);
  const etag = buildEtag(content);
  const ifNoneMatchHeader = request.req.header('if-none-match');
  const presentedEtags = ifNoneMatchHeader ? ifNoneMatchHeader.split(',') : [];
  const normalizedEtags = presentedEtags.map((value) => value.trim());

  if (normalizedEtags.includes('*') || normalizedEtags.includes(etag)) {
    reply.code(304);
    reply.header('Cache-Control', CACHE_CONTROL_HEADER);
    reply.header('ETag', etag);
    return reply.send();
  }

  reply.header('Cache-Control', CACHE_CONTROL_HEADER);
  reply.header('ETag', etag);
  reply.header('Content-Length', content.length);
  reply.type(lookUpMimeType(storage.absolute));
  return reply.send(content);
}

async function checkFilePreconditions(request: StorageContext, filePath: string): Promise<void> {
  const ifMatch = request.req.header('if-match');
  const ifNoneMatch = request.req.header('if-none-match');
  if (!ifMatch && !ifNoneMatch) return;
  let etag: string;
  try {
    etag = buildEtag(await readFile(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const matches = (header: string) =>
    Boolean(etag) && header.split(',').some((value) => value.trim() === '*' || value.trim() === etag);
  if ((ifMatch && !matches(ifMatch)) || (ifNoneMatch && matches(ifNoneMatch))) {
    throw new StorageError('File changed; reload before saving', 412);
  }
}

async function listDirectory(storage: StoragePath): Promise<unknown[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(storage.absolute, {withFileTypes: true});
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') entries = [];
    else if (err.code === 'ENOTDIR') throw new StorageError('Path is not a directory', 400);
    else throw error;
  }
  const statuses = storage.scope === 'proj' ? await gitStatus(storage.projectRoot) : new Map<string, GitStatus>();
  const results: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.name.startsWith('.')) {
      continue;
    }
    const relativeName = storage.relative ? `${storage.relative}/${entry.name}` : entry.name;
    const posixPath = toPosix([storage.scope, storage.id, relativeName]);
    const absolute = path.join(storage.projectRoot, relativeName);
    const entryStats = await stat(absolute);
    if (entry.isDirectory()) {
      results.push({
        type: 'folder',
        path: posixPath,
        name: entry.name,
        created: Math.trunc(entryStats.birthtimeMs),
        modified: Math.trunc(entryStats.mtimeMs),
        gitStatus: statusForPath(statuses, relativeName),
      });
    } else {
      results.push({
        type: 'file',
        path: posixPath,
        name: entry.name,
        size: entryStats.size,
        created: Math.trunc(entryStats.birthtimeMs),
        modified: Math.trunc(entryStats.mtimeMs),
        gitStatus: statusForPath(statuses, relativeName),
      });
    }
  }
  const prefix = storage.relative ? `${storage.relative}/` : '';
  for (const [filename, status] of statuses) {
    if (status !== 'deleted' || !filename.startsWith(prefix)) continue;
    const rest = filename.slice(prefix.length);
    const name = rest.split('/')[0];
    if (!name || name.startsWith('.') || results.some((entry) => entry.name === name)) continue;
    results.push({
      type: rest.includes('/') ? 'folder' : 'file',
      path: toPosix([storage.scope, storage.id, storage.relative, name]),
      name,
      created: 0,
      modified: 0,
      gitStatus: 'deleted',
      ...(rest.includes('/') ? {} : {size: 0}),
    });
  }
  return results;
}

async function describeFile(storage: StoragePath): Promise<unknown> {
  const statuses = storage.scope === 'proj' ? await gitStatus(storage.projectRoot) : new Map<string, GitStatus>();
  const info = await stat(storage.absolute);
  if (info.isDirectory()) {
    return {
      type: 'folder',
      path: storage.posixPath,
      name: path.basename(storage.absolute),
      created: Math.trunc(info.birthtimeMs),
      modified: Math.trunc(info.mtimeMs),
      gitStatus: statusForPath(statuses, storage.relative),
    };
  }
  return {
    type: 'file',
    path: storage.posixPath,
    name: path.basename(storage.absolute),
    size: info.size,
    created: Math.trunc(info.birthtimeMs),
    modified: Math.trunc(info.mtimeMs),
    gitStatus: statusForPath(statuses, storage.relative),
  };
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, {recursive: true});
}
async function resolveStorageContext(
  rawPath: string,
  request: StorageContext,
  context: FileRouteContext
): Promise<{storage: StoragePath; auth: UserAuth}> {
  const storage = buildStoragePath(rawPath, context.rootDir);
  await ensureNoSymlink(storage, context.rootDir);
  const auth = await resolveAuth(context.authProvider, request);
  return {storage, auth};
}

async function handleFileDownload(
  request: StorageContext,
  reply: HonoReply,
  rawPath: string,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<unknown> => {
      const {storage, auth} = await resolveStorageContext(rawPath, request, context);
      await ensureRead(auth, storage.id);
      let info;
      try {
        info = await stat(storage.absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('File not found', 404);
        }
        throw error;
      }
      if (info.isDirectory()) {
        throw new StorageError('Requested path is a directory', 400);
      }
      return sendFileReply(request, reply, storage);
    },
    context.logger
  );
}

async function handleGetOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  if (!query.path) {
    reply.code(400).send({message: 'Path is required'});
    return;
  }
  await handleFileDownload(request, reply, query.path, context);
}

async function handleListOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<unknown[]> => {
      if (!query.path) {
        throw new StorageError('Path is required', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureRead(auth, storage.id);
      return listDirectory(storage);
    },
    context.logger
  );
}

async function handleInfoOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<unknown> => {
      if (!query.path) {
        throw new StorageError('Path is required', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureRead(auth, storage.id);
      try {
        return await describeFile(storage);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          if (storage.scope === 'proj') {
            const statuses = await gitStatus(storage.projectRoot);
            const status = statusForPath(statuses, storage.relative);
            if (status === 'deleted') {
              const folder = [...statuses.keys()].some((name) => name.startsWith(`${storage.relative}/`));
              return {
                type: folder ? 'folder' : 'file',
                path: storage.posixPath,
                name: path.basename(storage.absolute),
                ...(folder ? {} : {size: 0}),
                created: 0,
                modified: 0,
                gitStatus: 'deleted',
              };
            }
          }
          throw new StorageError('File not found', 404);
        }
        throw error;
      }
    },
    context.logger
  );
}

async function handleUploadOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<string> => {
      if (!query.path) {
        throw new StorageError('Path is required', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureWrite(auth, storage.id);
      ensureMutable(storage);
      const exists = await fileExists(storage.absolute);
      if (query.exists === 'fail' && exists) {
        throw new StorageError('File already exists', 409);
      }
      const buffer = await streamToBuffer(request);
      if (query.crc) {
        const computed = crc32(buffer).toString(16).padStart(8, '0');
        if (computed !== query.crc.toLowerCase()) {
          throw new StorageError('CRC mismatch', 412);
        }
      }
      await checkFilePreconditions(request, storage.absolute);
      await ensureParentDirectory(storage.absolute);
      const temporary = path.join(path.dirname(storage.absolute), `.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, buffer, {flag: 'wx'});
        await rename(temporary, storage.absolute);
      } finally {
        await rm(temporary, {force: true});
      }
      reply.header('ETag', buildEtag(buffer));
      reply.type('text/plain; charset=utf-8');
      await logFileChange(storage, auth, exists ? 'edit' : 'create');
      return Buffer.byteLength(buffer).toString();
    },
    context.logger
  );
}

async function handleMkdirOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path) {
        throw new StorageError('Path is required', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureWrite(auth, storage.id);
      ensureMutable(storage, true);
      const exists = await fileExists(storage.absolute);
      await mkdir(storage.absolute, {recursive: true});
      if (!exists) await logFileChange(storage, auth, 'mkdir');
      return undefined;
    },
    context.logger
  );
}

async function handleDeleteOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path) {
        throw new StorageError('Path is required', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureWrite(auth, storage.id);
      ensureMutable(storage);
      try {
        await checkFilePreconditions(request, storage.absolute);
        await rm(storage.absolute, {recursive: true, force: false});
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('File not found', 404);
        }
        throw error;
      }
      await logFileChange(storage, auth, 'delete');
      return undefined;
    },
    context.logger
  );
}

async function handleGitRestoreOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path) throw new StorageError('Path is required', 400);
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      if (storage.scope !== 'proj' || !storage.relative) throw new StorageError('Project file is required', 400);
      await ensureWrite(auth, storage.id);
      ensureMutable(storage);
      await restoreGitFile(storage.projectRoot, storage.relative, auth);
    },
    context.logger
  );
}

async function handleMoveOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path || !query.dest) {
        throw new StorageError('Source and destination paths are required', 400);
      }
      const {storage: source, auth} = await resolveStorageContext(query.path, request, context);
      const destination = buildStoragePath(query.dest, context.rootDir);
      await ensureNoSymlink(destination, context.rootDir);
      if (source.scope !== destination.scope || source.id !== destination.id) {
        throw new StorageError('Move must remain within the same scope and identifier', 400);
      }
      await ensureWrite(auth, source.id);
      ensureMutable(source);
      ensureMutable(destination);
      await ensureParentDirectory(destination.absolute);
      try {
        await rename(source.absolute, destination.absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('Source file not found', 404);
        }
        throw error;
      }
      await logFileChange(source, auth, 'move', destination);
      return undefined;
    },
    context.logger
  );
}

async function handleCopyOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path || !query.dest) {
        throw new StorageError('Source and destination paths are required', 400);
      }
      const {storage: source, auth} = await resolveStorageContext(query.path, request, context);
      const destination = buildStoragePath(query.dest, context.rootDir);
      await ensureNoSymlink(destination, context.rootDir);
      if (source.scope !== destination.scope || source.id !== destination.id) {
        throw new StorageError('Copy must remain within the same scope and identifier', 400);
      }
      await ensureWrite(auth, source.id);
      ensureMutable(destination);
      await ensureParentDirectory(destination.absolute);
      try {
        const info = await stat(source.absolute);
        if (info.isDirectory()) {
          throw new StorageError('Copy does not support directories', 400);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('Source file not found', 404);
        }
        throw error;
      }
      await copyFile(source.absolute, destination.absolute);
      await logFileChange(source, auth, 'copy', destination);
      return undefined;
    },
    context.logger
  );
}

async function handleRenameOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      if (!query.path || !query.name) {
        throw new StorageError('Path and name are required', 400);
      }
      const sanitized = query.name.replace(/\\/g, '/');
      if (!sanitized || sanitized.includes('/') || sanitized === '.' || sanitized === '..') {
        throw new StorageError('Invalid name parameter', 400);
      }
      const {storage, auth} = await resolveStorageContext(query.path, request, context);
      await ensureWrite(auth, storage.id);
      ensureMutable(storage);
      const destinationPath = path.join(path.dirname(storage.absolute), sanitized);
      const relativeToProject = path.relative(storage.projectRoot, destinationPath).split(path.sep).join('/');
      if (relativeToProject.startsWith('..')) {
        throw new StorageError('Rename target escapes project root', 400);
      }
      const cleanedRelative = relativeToProject === '.' ? '' : relativeToProject;
      const destination: StoragePath = {
        scope: storage.scope,
        id: storage.id,
        relative: cleanedRelative,
        absolute: destinationPath,
        projectRoot: storage.projectRoot,
        posixPath: toPosix([storage.scope, storage.id, cleanedRelative]),
      };
      await ensureNoSymlink(destination, context.rootDir);
      ensureMutable(destination);
      await ensureParentDirectory(destination.absolute);
      try {
        await rename(storage.absolute, destination.absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('Source entry not found', 404);
        }
        throw error;
      }
      await logFileChange(storage, auth, 'rename', destination);
      return undefined;
    },
    context.logger
  );
}

export {
  buildEtag,
  buildStoragePath,
  crc32,
  describeFile,
  ensureParentDirectory,
  ensureRead,
  ensureWrite,
  fileExists,
  handleFileDownload,
  handleGetOp,
  handleListOp,
  handleInfoOp,
  handleUploadOp,
  handleMkdirOp,
  handleDeleteOp,
  handleGitRestoreOp,
  handleMoveOp,
  handleCopyOp,
  handleRenameOp,
  listDirectory,
  resolveAuth,
  resolveStorageContext,
  sendFileReply,
  streamToBuffer,
};
export type {FileRouteContext, StoragePath};
