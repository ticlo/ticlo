import type {Dirent} from 'node:fs';
import {constants as fsConstants, promises as fs} from 'node:fs';
import path from 'node:path';
import AdmZip, {IZipEntry} from 'adm-zip';
import type {UserAuth} from './auth.ts';
import {ensureParentDirectory, ensureWrite} from './fileOperations.ts';
import {ProjectMetadata, StorageError} from './types.ts';

const {access, readdir, mkdir, copyFile, writeFile, readFile, rm, rename} = fs;

const PROJECT_SCOPE = 'proj';
const PROJECT_METADATA_FILE = '.proj';
const KEEP_DIRECTORY_PLACEHOLDER = '.DGSERVER_KEEP_DIRECTORY';

function sanitizeProjectId(rawId?: string | null, field = 'Project id'): string {
  if (typeof rawId !== 'string') {
    throw new StorageError(`${field} is required`, 400);
  }
  const trimmed = rawId.trim();
  if (!trimmed) {
    throw new StorageError(`${field} is required`, 400);
  }
  if (
    trimmed.includes('/') ||
    trimmed.includes('.') ||
    trimmed === 'HEAD' ||
    trimmed.includes('@{') ||
    trimmed.startsWith('-') ||
    /[\u0000-\u0020\u007f~^:?*[\\]/.test(trimmed)
  ) {
    throw new StorageError('Invalid project id', 400);
  }
  return trimmed;
}

function projectRootPath(baseDir: string, projectId: string): string {
  return path.join(baseDir, PROJECT_SCOPE, projectId);
}

async function projectDirectoryExists(baseDir: string, projectId: string): Promise<boolean> {
  try {
    await access(projectRootPath(baseDir, projectId), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readProjectMetadata(baseDir: string, projectId: string): Promise<ProjectMetadata | null> {
  await migrateProjectMetadata(baseDir, projectId);
  const metadataPath = path.join(projectRootPath(baseDir, projectId), PROJECT_METADATA_FILE);
  try {
    const content = await readFile(metadataPath, 'utf8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {...parsed, id: projectId};
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new StorageError(`Project ${projectId} metadata is invalid JSON`, 500);
    }
    throw error;
  }
}

async function migrateProjectMetadata(baseDir: string, projectId: string): Promise<void> {
  const projectRoot = projectRootPath(baseDir, projectId);
  const oldPath = path.join(projectRoot, '_proj.json');
  const newPath = path.join(projectRoot, PROJECT_METADATA_FILE);
  try {
    await access(oldPath, fsConstants.F_OK);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  try {
    await access(newPath, fsConstants.F_OK);
    throw new StorageError(`Project ${projectId} has both metadata files`, 409);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await rename(oldPath, newPath);
}

async function writeProjectMetadata(
  baseDir: string,
  projectId: string,
  metadata: Record<string, unknown>
): Promise<ProjectMetadata> {
  const finalMeta: ProjectMetadata = {
    ...metadata,
    id: projectId,
  } as ProjectMetadata;
  const metadataPath = path.join(projectRootPath(baseDir, projectId), PROJECT_METADATA_FILE);
  await writeFile(metadataPath, `${JSON.stringify(finalMeta, null, 2)}\n`, 'utf8');
  return finalMeta;
}

async function listProjectsForAuth(baseDir: string, auth: UserAuth): Promise<ProjectMetadata[]> {
  const projectsDir = path.join(baseDir, PROJECT_SCOPE);
  let entries: Dirent[];
  try {
    entries = await readdir(projectsDir, {withFileTypes: true});
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const visibleProjects: ProjectMetadata[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.includes('.')) {
      continue;
    }
    const projectId = entry.name;
    let allowed: boolean;
    try {
      allowed = await auth.canRead(projectId);
    } catch {
      throw new StorageError(`Authorization failed for project ${projectId}`, 403);
    }
    if (!allowed) {
      continue;
    }
    const metadata = await readProjectMetadata(baseDir, projectId);
    if (metadata) {
      visibleProjects.push(metadata);
    }
  }

  visibleProjects.sort((a, b) => {
    const nameA = typeof a.name === 'string' ? (a.name as string).toLowerCase() : a.id.toLowerCase();
    const nameB = typeof b.name === 'string' ? (b.name as string).toLowerCase() : b.id.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return visibleProjects;
}

async function copyTemplateDirectory(sourceDir: string, targetDir: string, includeHidden = false): Promise<void> {
  const entries = await readdir(sourceDir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name === '.git' || (entry.name.startsWith('.') && !includeHidden)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await mkdir(targetPath, {recursive: true});
      await copyTemplateDirectory(sourcePath, targetPath, includeHidden);
    } else if (entry.isFile()) {
      await ensureParentDirectory(targetPath);
      await copyFile(sourcePath, targetPath);
    }
  }
}

async function safeGetUserId(auth: UserAuth): Promise<string> {
  try {
    const id = await auth.getUserId();
    return typeof id === 'string' && id.trim() ? id : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function normalizeProjectIdFromName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    throw new StorageError('Project name is required', 400);
  }
  const candidate = trimmed.replace(/[^A-Za-z0-9._-]+/g, '_');
  return sanitizeProjectId(candidate, 'Project name');
}

async function generateUniqueProjectId(baseDir: string, desiredId: string): Promise<string> {
  let candidate = desiredId;
  while (await projectDirectoryExists(baseDir, candidate)) {
    candidate = `${desiredId}_${Math.random().toString(36).substring(2, 6)}`;
  }
  return candidate;
}

async function createProjectArchiveBuffer(baseDir: string, projectId: string): Promise<Buffer> {
  const projectRoot = projectRootPath(baseDir, projectId);
  if (!(await projectDirectoryExists(baseDir, projectId))) {
    throw new StorageError('Project not found', 404);
  }

  const zip = new AdmZip();

  async function collect(relative: string): Promise<void> {
    const absolute = relative ? path.join(projectRoot, relative) : projectRoot;
    const entries = await readdir(absolute, {withFileTypes: true});
    const visible = entries.filter((entry) => {
      if (!entry.name.startsWith('.')) {
        return true;
      }
      return entry.name === PROJECT_METADATA_FILE;
    });

    if (visible.length === 0) {
      const placeholderPath = relative
        ? path.posix.join(projectId, relative.replace(/\\/g, '/'), KEEP_DIRECTORY_PLACEHOLDER)
        : path.posix.join(projectId, KEEP_DIRECTORY_PLACEHOLDER);
      zip.addFile(placeholderPath, Buffer.alloc(0));
      return;
    }

    for (const entry of visible) {
      const childRelative = relative ? path.join(relative, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await collect(childRelative);
      } else if (entry.isFile()) {
        const data = await readFile(path.join(projectRoot, childRelative));
        const zipEntryName = path.posix.join(projectId, childRelative.replace(/\\/g, '/'));
        zip.addFile(zipEntryName, data);
      }
    }
  }

  await collect('');
  return zip.toBuffer();
}

interface NormalizedArchiveEntry {
  projectId: string;
  relativePath: string;
  entry: IZipEntry;
}

async function importProjectsFromArchive(
  baseDir: string,
  auth: UserAuth,
  archiveBuffer: Buffer
): Promise<ProjectMetadata[]> {
  if (archiveBuffer.length === 0) {
    throw new StorageError('Archive payload is empty', 400);
  }

  const zip = new AdmZip(archiveBuffer);
  const entries = zip.getEntries();
  if (!entries.length) {
    throw new StorageError('Archive does not contain any files', 400);
  }

  let forcedProjectId: string | null = null;
  const singleProjectMeta = entries.find((entry) =>
    [PROJECT_METADATA_FILE, '_proj.json'].includes(entry.entryName.replace(/\\/g, '/'))
  );
  if (singleProjectMeta) {
    const parsed = JSON.parse(singleProjectMeta.getData().toString('utf8')) as Record<string, unknown>;
    const rawId = typeof parsed.id === 'string' ? parsed.id : undefined;
    forcedProjectId = sanitizeProjectId(rawId ?? '', 'Project id');
  }

  const normalized: NormalizedArchiveEntry[] = [];
  for (const entry of entries) {
    let entryName = entry.entryName.replace(/\\/g, '/');
    entryName = entryName.replace(/^\/+/, '');
    if (!entryName) {
      continue;
    }
    const segments = entryName.split('/').filter(Boolean);
    if (segments.some((segment) => segment === '..')) {
      throw new StorageError('Archive contains invalid paths', 400);
    }
    if (segments.some((segment) => segment.startsWith('.') && segment !== PROJECT_METADATA_FILE)) {
      continue;
    }

    if (forcedProjectId) {
      const relativePath = segments.join('/');
      if (!relativePath && entry.isDirectory) {
        continue;
      }
      normalized.push({projectId: forcedProjectId, relativePath, entry});
    } else {
      if (segments.length === 0) {
        continue;
      }
      const [projectIdSegment, ...rest] = segments;
      const projectId = sanitizeProjectId(projectIdSegment);
      const relativePath = rest.join('/');
      if (!relativePath && entry.isDirectory) {
        continue;
      }
      normalized.push({projectId, relativePath, entry});
    }
  }

  if (!normalized.length) {
    throw new StorageError('Archive does not contain any project files', 400);
  }

  const owner = await safeGetUserId(auth);
  const importedProjects = new Map<string, ProjectMetadata>();

  const grouped = normalized.reduce<Record<string, NormalizedArchiveEntry[]>>((acc, item) => {
    const list = acc[item.projectId] ?? [];
    list.push(item);
    acc[item.projectId] = list;
    return acc;
  }, {});

  for (const [projectId, items] of Object.entries(grouped)) {
    await ensureWrite(auth, projectId);
    const projectRoot = projectRootPath(baseDir, projectId);
    await mkdir(projectRoot, {recursive: true});

    for (const {entry, relativePath} of items) {
      if (!relativePath && entry.isDirectory) {
        continue;
      }
      if (relativePath.endsWith(KEEP_DIRECTORY_PLACEHOLDER)) {
        continue;
      }
      const safeRelative = relativePath.replace(/\\/g, '/');
      const destinationPath = path.join(projectRoot, safeRelative);
      if (entry.isDirectory) {
        await mkdir(destinationPath, {recursive: true});
      } else {
        await ensureParentDirectory(destinationPath);
        await writeFile(destinationPath, entry.getData());
      }
    }

    const metadata = await readProjectMetadata(baseDir, projectId);
    if (!metadata) {
      await rm(projectRoot, {recursive: true, force: true});
      throw new StorageError(`Imported project ${projectId} is missing metadata`, 400);
    }
    metadata.owner = owner;
    metadata.id = projectId;
    if (!Array.isArray(metadata.canRead)) {
      metadata.canRead = [];
    }
    if (!Array.isArray(metadata.canWrite)) {
      metadata.canWrite = [];
    }
    const saved = await writeProjectMetadata(baseDir, projectId, metadata);
    importedProjects.set(projectId, saved);
  }

  return Array.from(importedProjects.values());
}

export {
  KEEP_DIRECTORY_PLACEHOLDER,
  PROJECT_METADATA_FILE,
  PROJECT_SCOPE,
  copyTemplateDirectory,
  createProjectArchiveBuffer,
  generateUniqueProjectId,
  importProjectsFromArchive,
  listProjectsForAuth,
  migrateProjectMetadata,
  normalizeProjectIdFromName,
  projectDirectoryExists,
  projectRootPath,
  readProjectMetadata,
  sanitizeProjectId,
  safeGetUserId,
  writeProjectMetadata,
};
export type {ProjectMetadata};
