import {promises as fs} from 'node:fs';
import path from 'node:path';
import {
  copyTemplateDirectory,
  createProjectArchiveBuffer,
  generateUniqueProjectId,
  importProjectsFromArchive,
  listProjectsForAuth,
  normalizeProjectIdFromName,
  projectDirectoryExists,
  projectRootPath,
  projectScopeDir,
  readProjectMetadata,
  sanitizeProjectId,
  safeGetUserId,
  writeProjectMetadata,
} from './projectOperations.ts';
import {handleErrors, type HonoReply} from './utils.ts';
import {logChange, verifyHistoryCommit, withCommitWorktree} from './gitOperations.ts';
import {ensureRead, ensureWrite, resolveAuth, streamToBuffer, type FileRouteContext} from './fileOperations.ts';
import {FileQuerystring, ProjectMetadata, StorageContext, StorageError} from './types.ts';

const {mkdir, rm} = fs;

async function handleListProjectsOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata[]> => {
      const auth = await resolveAuth(context.authProvider, request);
      return listProjectsForAuth(projectScopeDir(context.rootDir, query.scope), auth);
    },
    context.logger
  );
}

async function handleReadProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureRead(auth, projectId);
      const metadata = await readProjectMetadata(baseDir, projectId);
      if (!metadata) {
        throw new StorageError('Project not found', 404);
      }
      return metadata;
    },
    context.logger
  );
}

async function handleCreateProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const nameParam = query.name;
      if (!nameParam) {
        throw new StorageError('Project name is required', 400);
      }
      const templateId = query.template ? sanitizeProjectId(query.template, 'Template id') : undefined;
      const commit = query.commit;
      if (commit === '') throw new StorageError('Commit is required', 400);
      if (commit && !templateId) throw new StorageError('A source project is required for a commit', 400);
      const auth = await resolveAuth(context.authProvider, request);
      if (templateId) {
        await ensureRead(auth, templateId);
        if (!(await projectDirectoryExists(baseDir, templateId))) {
          throw new StorageError('Template project not found', 404);
        }
      }
      const desiredId = normalizeProjectIdFromName(nameParam);
      const projectId = await generateUniqueProjectId(baseDir, desiredId);
      await ensureWrite(auth, projectId);
      const projectDir = projectRootPath(baseDir, projectId);
      const templateRoot = templateId ? projectRootPath(baseDir, templateId) : undefined;
      if (commit && templateRoot) await verifyHistoryCommit(templateRoot, commit);
      const templateMeta = templateId ? await readProjectMetadata(baseDir, templateId) : null;
      await mkdir(projectDir, {recursive: true});
      if (templateRoot) {
        if (commit) {
          await withCommitWorktree(templateRoot, commit, (directory) => copyTemplateDirectory(directory, projectDir));
        } else await copyTemplateDirectory(templateRoot, projectDir);
      }
      const owner = await safeGetUserId(auth);
      const metadata: Record<string, unknown> = {
        owner,
        name: nameParam,
        isTemplate: false,
        canRead: [],
        canWrite: [],
      };
      if (templateMeta && typeof templateMeta.category !== 'undefined') {
        metadata.category = templateMeta.category;
      }
      const saved = await writeProjectMetadata(baseDir, projectId, metadata);
      return saved;
    },
    context.logger
  );
}

async function handleUpdateProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureWrite(auth, projectId);
      if (!(await projectDirectoryExists(baseDir, projectId))) {
        throw new StorageError('Project not found', 404);
      }
      const buffer = await streamToBuffer(request);
      const body = buffer.toString('utf8').trim();
      if (!body) {
        throw new StorageError('Request body is required', 400);
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new StorageError('Request body must be valid JSON', 400);
      }
      if (typeof payload !== 'object' || payload === null) {
        throw new StorageError('Project data must be a JSON object', 400);
      }
      const data = {...(payload as Record<string, unknown>)};
      delete data.id;
      const saved = await writeProjectMetadata(baseDir, projectId, data);
      await logChange(projectRootPath(baseDir, projectId), auth, 'edit', '.proj');
      return saved;
    },
    context.logger
  );
}

async function handleDeleteProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureWrite(auth, projectId);
      const projectDir = projectRootPath(baseDir, projectId);
      try {
        await rm(projectDir, {recursive: true, force: false});
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new StorageError('Project not found', 404);
        }
        throw error;
      }
      return undefined;
    },
    context.logger
  );
}

async function handleExportProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<void> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureRead(auth, projectId);
      const archive = await createProjectArchiveBuffer(baseDir, projectId);
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', 'attachment; filename="' + projectId + '.zip"');
      reply.header('Content-Length', archive.length);
      reply.send(archive);
      return undefined;
    },
    context.logger
  );
}

async function handleImportProjectOp(
  query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata[]> => {
      const baseDir = projectScopeDir(context.rootDir, query.scope);
      const auth = await resolveAuth(context.authProvider, request);
      const payload = await streamToBuffer(request);
      const imported = await importProjectsFromArchive(baseDir, auth, payload);
      for (const project of imported) {
        await logChange(projectRootPath(baseDir, project.id), auth, 'import', '.proj');
      }
      return imported;
    },
    context.logger
  );
}

export {
  handleCreateProjectOp,
  handleDeleteProjectOp,
  handleExportProjectOp,
  handleImportProjectOp,
  handleListProjectsOp,
  handleReadProjectOp,
  handleUpdateProjectOp,
};
