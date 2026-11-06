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
  readProjectMetadata,
  sanitizeProjectId,
  safeGetUserId,
  writeProjectMetadata,
} from './projectOperations.ts';
import {handleErrors, type HonoReply} from './utils.ts';
import {forkGit, hasGit, logChange} from './gitOperations.ts';
import {ensureRead, ensureWrite, resolveAuth, streamToBuffer, type FileRouteContext} from './fileOperations.ts';
import {FileQuerystring, ProjectMetadata, StorageContext, StorageError} from './types.ts';

const {mkdir, rm} = fs;

async function handleListProjectsOp(
  _query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata[]> => {
      const auth = await resolveAuth(context.authProvider, request);
      return listProjectsForAuth(context.rootDir, auth);
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
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureRead(auth, projectId);
      const metadata = await readProjectMetadata(context.rootDir, projectId);
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
      const nameParam = query.name;
      if (!nameParam) {
        throw new StorageError('Project name is required', 400);
      }
      const templateId = query.template ? sanitizeProjectId(query.template, 'Template id') : undefined;
      const auth = await resolveAuth(context.authProvider, request);
      if (templateId) {
        await ensureRead(auth, templateId);
        if (!(await projectDirectoryExists(context.rootDir, templateId))) {
          throw new StorageError('Template project not found', 404);
        }
      }
      const desiredId = normalizeProjectIdFromName(nameParam);
      const projectId = await generateUniqueProjectId(context.rootDir, desiredId);
      await ensureWrite(auth, projectId);
      const projectDir = projectRootPath(context.rootDir, projectId);
      const templateRoot = templateId ? projectRootPath(context.rootDir, templateId) : undefined;
      const fork = templateRoot ? await hasGit(templateRoot) : false;
      const templateMeta = templateId ? await readProjectMetadata(context.rootDir, templateId) : null;
      await mkdir(projectDir, {recursive: true});
      if (templateRoot) await copyTemplateDirectory(templateRoot, projectDir, fork);
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
      const saved = await writeProjectMetadata(context.rootDir, projectId, metadata);
      if (fork && templateRoot) {
        await forkGit(templateRoot, projectDir, projectId);
        await logChange(projectDir, auth, 'fork', '.proj', templateId);
      }
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
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureWrite(auth, projectId);
      if (!(await projectDirectoryExists(context.rootDir, projectId))) {
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
      const saved = await writeProjectMetadata(context.rootDir, projectId, data);
      await logChange(projectRootPath(context.rootDir, projectId), auth, 'edit', '.proj');
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
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureWrite(auth, projectId);
      const projectDir = projectRootPath(context.rootDir, projectId);
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
      const projectId = sanitizeProjectId(query.id);
      const auth = await resolveAuth(context.authProvider, request);
      await ensureRead(auth, projectId);
      const archive = await createProjectArchiveBuffer(context.rootDir, projectId);
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
  _query: FileQuerystring,
  request: StorageContext,
  reply: HonoReply,
  context: FileRouteContext
): Promise<void> {
  await handleErrors(
    reply,
    async (): Promise<ProjectMetadata[]> => {
      const auth = await resolveAuth(context.authProvider, request);
      const payload = await streamToBuffer(request);
      const imported = await importProjectsFromArchive(context.rootDir, auth, payload);
      for (const project of imported) {
        await logChange(projectRootPath(context.rootDir, project.id), auth, 'import', '.proj');
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
