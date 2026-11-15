import {StorageError, filePath, projectId, type FileReadResult, type FileRequest} from './FileAccess.ts';

export type FilePathKind = 'url' | 'external' | 'project' | 'relative';

export type ParsedFilePath =
  | {kind: 'url'; path: string}
  | {kind: 'external'; path: string}
  | {kind: 'project'; project: string; relativePath: string; storagePath: string};

export function normalizeLibraryId(library?: string): string {
  if (!library) return '#root';
  return library.startsWith('+') ? library.slice(1) || '#root' : library;
}

/**
 * Classify a file-path string according to the 4 Ticlo path rules:
 * 1) url: http://, https://, // (checked before '/' so '//' is not treated as external)
 * 2) external: /, ./, ../
 * 3) project: +project/path
 * 4) relative: +/path (resolved under current project)
 */
export function classifyFilePath(path: string): FilePathKind | undefined {
  if (typeof path !== 'string' || !path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
    return 'url';
  }
  if (path.startsWith('/') || path.startsWith('./') || path.startsWith('../')) {
    return 'external';
  }
  if (path.startsWith('+/')) {
    return 'relative';
  }
  if (path.startsWith('+')) {
    return 'project';
  }
  return undefined;
}

/** Fast O(1) check for non-empty case 4) (+/...) paths on hot input paths. */
export function isRelativeProjectFilePath(path: string): boolean {
  return path.length > 2 && path.charCodeAt(0) === 43 && path.charCodeAt(1) === 47;
}

/**
 * Rewrite case 4) (+/...) file-path strings to case 3) (+outerLibrary/...) when crossing library boundaries into a subflow.
 */
export function resolveSubflowFilePath(value: unknown, outerLibrary?: string, subLibrary?: string): unknown {
  if (
    outerLibrary &&
    subLibrary &&
    outerLibrary !== subLibrary &&
    typeof value === 'string' &&
    isRelativeProjectFilePath(value)
  ) {
    const prefix = outerLibrary.startsWith('+') ? outerLibrary : `+${outerLibrary}`;
    return `${prefix}${value.slice(1)}`;
  }
  return value;
}

/**
 * Parse and validate a file-path into url, external, or project storage path.
 * Throws StorageError('invalid-path') for empty or invalid project/relative paths.
 */
export function parseFilePath(path: string, library?: string): ParsedFilePath {
  const kind = classifyFilePath(path);
  if (!kind) {
    throw new StorageError('Invalid file path', 'invalid-path');
  }
  if (kind === 'url') {
    return {kind: 'url', path};
  }
  if (kind === 'external') {
    return {kind: 'external', path};
  }
  const raw = path.slice(1);
  const slash = raw.indexOf('/');
  if (slash < 0 || slash === raw.length - 1) {
    throw new StorageError('Invalid file path', 'invalid-path');
  }
  const project = slash === 0 ? normalizeLibraryId(library) : raw.slice(0, slash);
  const relativePath = raw.slice(slash + 1);
  projectId(project);
  filePath(relativePath);
  return {
    kind: 'project',
    project,
    relativePath,
    storagePath: `${project}/${relativePath}`,
  };
}

export function tryParseFilePath(path: string, library?: string): ParsedFilePath | undefined {
  try {
    return parseFilePath(path, library);
  } catch (error) {
    if (error instanceof StorageError && error.code === 'invalid-path') return undefined;
    throw error;
  }
}

export function buildProjectFileUrl(baseURL: string, storagePath: string): string {
  filePath(storagePath, true);
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${baseURL.replace(/\/$/, '')}/proj/${encoded}`;
}

export async function fetchFileResult(
  url: string,
  options: FileRequest & {fetch?: typeof fetch} = {}
): Promise<FileReadResult> {
  options.signal?.throwIfAborted();
  const response = await (options.fetch ?? fetch)(url, {signal: options.signal});
  if (!response.ok) {
    throw new StorageError(`HTTP ${response.status}`, response.status === 404 ? 'not-found' : 'io');
  }
  return {
    data: await response.arrayBuffer(),
    revision: response.headers.get('ETag') ?? undefined,
    contentType: response.headers.get('Content-Type') ?? undefined,
  };
}
