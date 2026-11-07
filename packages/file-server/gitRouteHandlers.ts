import {lstat} from 'node:fs/promises';
import {
  commitGit,
  deleteGitBranch,
  gitBranches,
  gitHistory,
  gitInfo,
  initGit,
  resetGitToCommit,
} from './gitOperations.ts';
import {ensureRead, ensureWrite, resolveAuth, streamToBuffer, type FileRouteContext} from './fileOperations.ts';
import {projectDirectoryExists, projectRootPath, sanitizeProjectId} from './projectOperations.ts';
import {FileQuerystring, StorageContext, StorageError} from './types.ts';
import {handleErrors, type HonoReply} from './utils.ts';

async function projectContext(
  query: FileQuerystring,
  request: StorageContext,
  context: FileRouteContext,
  write = false
) {
  const id = sanitizeProjectId(query.id);
  const auth = await resolveAuth(context.authProvider, request);
  if (write) await ensureWrite(auth, id);
  else await ensureRead(auth, id);
  if (!(await projectDirectoryExists(context.rootDir, id))) throw new StorageError('Project not found', 404);
  const root = projectRootPath(context.rootDir, id);
  if ((await lstat(root)).isSymbolicLink()) throw new StorageError('Symlinks are not supported', 403);
  return {id, auth, root};
}

async function handleGitInfoOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context);
      return gitInfo(project.root);
    },
    context.logger
  );
}

async function handleGitInitOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context, true);
      await initGit(project.root);
      return gitInfo(project.root);
    },
    context.logger
  );
}

async function handleGitCommitOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context, true);
      const body = (await streamToBuffer(request)).toString('utf8');
      let message = '';
      if (body) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new StorageError('Invalid commit request', 400);
        }
        if (!parsed || typeof parsed !== 'object' || typeof (parsed as {message?: unknown}).message !== 'string') {
          throw new StorageError('Commit message must be a string', 400);
        }
        message = (parsed as {message: string}).message;
      }
      return commitGit(project.root, project.auth, message);
    },
    context.logger
  );
}

async function handleGitHistoryOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context);
      return gitHistory(project.root, query.branch);
    },
    context.logger
  );
}

async function handleGitBranchesOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context);
      return gitBranches(project.root);
    },
    context.logger
  );
}

async function handleGitDeleteBranchOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      if (!query.branch) throw new StorageError('Branch is required', 400);
      const project = await projectContext(query, request, context, true);
      await deleteGitBranch(project.root, query.branch);
    },
    context.logger
  );
}

async function handleGitResetOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
) {
  await handleErrors(
    reply,
    async () => {
      const project = await projectContext(query, request, context, true);
      if (!query.commit) throw new StorageError('Commit is required', 400);
      return {backupBranch: await resetGitToCommit(project.root, query.commit)};
    },
    context.logger
  );
}

export {
  handleGitInfoOp,
  handleGitInitOp,
  handleGitCommitOp,
  handleGitHistoryOp,
  handleGitBranchesOp,
  handleGitDeleteBranchOp,
  handleGitResetOp,
};
