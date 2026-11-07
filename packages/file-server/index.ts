import {promises as fs} from 'node:fs';
import path from 'node:path';
import type {Hono} from 'hono';
import {UserAuth} from './auth.ts';
import {
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
  type FileRouteContext,
} from './fileOperations.ts';
import {
  handleCreateProjectOp,
  handleDeleteProjectOp,
  handleExportProjectOp,
  handleImportProjectOp,
  handleListProjectsOp,
  handleReadProjectOp,
  handleUpdateProjectOp,
} from './projectRouteHandlers.ts';
import {
  handleGitCommitOp,
  handleGitBranchesOp,
  handleGitHistoryOp,
  handleGitInfoOp,
  handleGitInitOp,
  handleGitResetOp,
} from './gitRouteHandlers.ts';
import {migrateProjectMetadata} from './projectOperations.ts';
import {HonoReply, handleErrors, withStorageLock} from './utils.ts';
import {AuthProvider, FileQuerystring, FileStorageOptions, StorageContext, StorageError} from './types.ts';

const {mkdir, readdir} = fs;

const DEFAULT_PREFIX = '/file';
const DEFAULT_ROOT = path.resolve(process.cwd(), 'files');

const DEFAULT_AUTH: UserAuth = {
  getUserId: () => 'anonymous',
  canRead: () => true,
  canWrite: () => true,
};

export function routeRemoteStorage(app: Hono, options: FileStorageOptions = {}): void {
  const prefix = (options.prefix ?? DEFAULT_PREFIX).replace(/\/$/, '') || '/';
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_ROOT);
  const authProvider: AuthProvider = options.authProvider ?? (() => DEFAULT_AUTH);
  const fileContext: FileRouteContext = {
    rootDir,
    authProvider,
    logger: console,
  };
  const ready = initStorageRoot(rootDir);

  app.get(prefix, async (request) => {
    await ready;
    const reply = new HonoReply();
    const query = request.req.query() as FileQuerystring;
    const op = query.op;
    if (!op) {
      reply.code(400).send({message: 'Missing op parameter'});
      return reply.toResponse();
    }
    if (
      ![
        'get',
        'list',
        'info',
        'listProj',
        'readProj',
        'exportProj',
        'gitInfo',
        'gitHistory',
        'gitBranches',
        'user',
      ].includes(op)
    ) {
      return reply.code(405).header('Allow', 'POST').send({message: 'Operation requires POST'});
    }
    await dispatchOperation(op, query, request, reply);
    return reply.toResponse();
  });

  app.post(prefix, async (request) => {
    await ready;
    const reply = new HonoReply();
    const query = request.req.query() as FileQuerystring;
    const op = query.op;
    if (!op) {
      reply.code(400).send({message: 'Missing op parameter'});
      return reply.toResponse();
    }
    await withStorageLock(rootDir, () => dispatchOperation(op, query, request, reply));
    return reply.toResponse();
  });

  app.get(prefix + '/*', async (request) => {
    await ready;
    const reply = new HonoReply();
    const rawPath = getDownloadPath(request, prefix);
    await handleFileDownload(request, reply, rawPath, fileContext);
    return reply.toResponse();
  });

  async function dispatchOperation(
    op: string,
    query: FileQuerystring,
    request: StorageContext,
    reply: HonoReply
  ): Promise<void> {
    switch (op) {
      case 'user': {
        await handleErrors(
          reply,
          async () => {
            const auth = await authProvider(request);
            if (!auth) throw new StorageError('Authorization provider returned no auth context', 500);
            return {id: auth.getUserId()};
          },
          fileContext.logger
        );
        return;
      }
      case 'get': {
        await handleGetOp(query, request, reply, fileContext);
        return;
      }
      case 'list': {
        await handleListOp(query, request, reply, fileContext);
        return;
      }
      case 'info': {
        await handleInfoOp(query, request, reply, fileContext);
        return;
      }
      case 'upload': {
        await handleUploadOp(query, request, reply, fileContext);
        return;
      }
      case 'mkdir': {
        await handleMkdirOp(query, request, reply, fileContext);
        return;
      }
      case 'delete': {
        await handleDeleteOp(query, request, reply, fileContext);
        return;
      }
      case 'gitRestore': {
        await handleGitRestoreOp(query, request, reply, fileContext);
        return;
      }
      case 'move': {
        await handleMoveOp(query, request, reply, fileContext);
        return;
      }
      case 'copy': {
        await handleCopyOp(query, request, reply, fileContext);
        return;
      }
      case 'rename': {
        await handleRenameOp(query, request, reply, fileContext);
        return;
      }
      case 'listProj': {
        await handleListProjectsOp(query, request, reply, fileContext);
        return;
      }
      case 'readProj': {
        await handleReadProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'createProj': {
        await handleCreateProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'updateProj': {
        await handleUpdateProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'deleteProj': {
        await handleDeleteProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'exportProj': {
        await handleExportProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'importProj': {
        await handleImportProjectOp(query, request, reply, fileContext);
        return;
      }
      case 'gitInfo':
        await handleGitInfoOp(query, request, reply, fileContext);
        return;
      case 'gitInit':
        await handleGitInitOp(query, request, reply, fileContext);
        return;
      case 'gitCommit':
        await handleGitCommitOp(query, request, reply, fileContext);
        return;
      case 'gitHistory':
        await handleGitHistoryOp(query, request, reply, fileContext);
        return;
      case 'gitBranches':
        await handleGitBranchesOp(query, request, reply, fileContext);
        return;
      case 'gitReset':
        await handleGitResetOp(query, request, reply, fileContext);
        return;
      default:
        reply.code(400).send({message: 'Unsupported op: ' + op});
    }
  }
}

async function initStorageRoot(rootDir: string): Promise<void> {
  await mkdir(rootDir, {recursive: true});
  const projectsDir = path.join(rootDir, 'proj');
  await mkdir(projectsDir, {recursive: true});
  await mkdir(path.join(rootDir, 'usr'), {recursive: true});
  for (const entry of await readdir(projectsDir, {withFileTypes: true})) {
    if (entry.isDirectory()) await migrateProjectMetadata(rootDir, entry.name);
  }
}

function getDownloadPath(request: StorageContext, prefix: string): string {
  const pathPrefix = prefix + '/';
  const rawPath = request.req.path.startsWith(pathPrefix) ? request.req.path.slice(pathPrefix.length) : '';
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

export {devUserAuth} from './auth.ts';
export type {UserAuth} from './auth.ts';
export type {FileStorageOptions, AuthProvider};
