import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  CreateAxiosDefaults,
  type AxiosHeaderValue,
} from 'axios';
import type {ExistsBehavior, FileEntry, FileInfo, GitCommit, GitInfo, ProjectMetadata} from './FileClientTypes.ts';

interface UploadOptions {
  existsBehavior?: ExistsBehavior;
  crc?: string;
}

type UploadPayload = Uint8Array | string | Blob;
type ImportPayload = Uint8Array | Blob;
type TicloFileClientOptions = CreateAxiosDefaults;

class TicloFileClient {
  private readonly axiosInstance: AxiosInstance;

  constructor(config?: TicloFileClientOptions, axiosInstance?: AxiosInstance) {
    if (axiosInstance) {
      this.axiosInstance = axiosInstance;
      return;
    }

    const axiosConfig: TicloFileClientOptions = config ?? {baseURL: '/file'};
    this.axiosInstance = axios.create(axiosConfig);
  }

  async getFile(path: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<ArrayBuffer>> {
    const normalizedPath = normalizeFilePath(path);
    const {params: _params, ...restConfig} = config;
    const responseType = restConfig.responseType ?? 'arraybuffer';
    return this.axiosInstance.request<ArrayBuffer>({
      ...restConfig,
      method: 'GET',
      url: normalizedPath,
      responseType,
    });
  }

  async listFiles(path: string, config?: AxiosRequestConfig): Promise<FileEntry[]> {
    return this.requestOp<FileEntry[]>('GET', 'list', {path: normalizeOpPath(path)}, undefined, config);
  }

  async getFileInfo(path: string, config?: AxiosRequestConfig): Promise<FileInfo> {
    return this.requestOp<FileInfo>('GET', 'info', {path: normalizeOpPath(path)}, undefined, config);
  }

  async uploadFile(
    path: string,
    payload: UploadPayload,
    options: UploadOptions = {},
    config?: AxiosRequestConfig
  ): Promise<string> {
    return (await this.uploadFileResponse(path, payload, options, config)).data;
  }

  /** Upload a file and retain response headers, including its new ETag. */
  async uploadFileResponse(
    path: string,
    payload: UploadPayload,
    options: UploadOptions = {},
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<string>> {
    const query: Record<string, unknown> = {path: normalizeOpPath(path)};
    if (options.existsBehavior === 'fail') {
      query.exists = 'fail';
    }
    if (options.crc) {
      query.crc = options.crc;
    }
    const mergedConfig = mergeHeaders(config, {'Content-Type': 'application/octet-stream'});
    return this.requestOpResponse<string>('POST', 'upload', query, payload, mergedConfig);
  }

  async createDirectory(path: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>('POST', 'mkdir', {path: normalizeOpPath(path)}, undefined, config);
  }

  async deleteFile(path: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>('POST', 'delete', {path: normalizeOpPath(path)}, undefined, config);
  }

  async moveFile(sourcePath: string, destinationPath: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>(
      'POST',
      'move',
      {
        path: normalizeOpPath(sourcePath),
        dest: normalizeOpPath(destinationPath),
      },
      undefined,
      config
    );
  }

  async copyFile(sourcePath: string, destinationPath: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>(
      'POST',
      'copy',
      {
        path: normalizeOpPath(sourcePath),
        dest: normalizeOpPath(destinationPath),
      },
      undefined,
      config
    );
  }

  async renameFile(path: string, name: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>(
      'POST',
      'rename',
      {
        path: normalizeOpPath(path),
        name: normalizeEntryName(name),
      },
      undefined,
      config
    );
  }

  async listProjects(config?: AxiosRequestConfig): Promise<ProjectMetadata[]> {
    return this.requestOp<ProjectMetadata[]>('GET', 'listProj', {}, undefined, config);
  }

  async getCurrentUser(config?: AxiosRequestConfig): Promise<{id: string}> {
    return this.requestOp<{id: string}>('GET', 'user', {}, undefined, config);
  }

  async readProject(id: string, config?: AxiosRequestConfig): Promise<ProjectMetadata> {
    return this.requestOp<ProjectMetadata>('GET', 'readProj', {id: normalizeIdentifier(id)}, undefined, config);
  }

  async createProject(name: string, templateId?: string, config?: AxiosRequestConfig): Promise<ProjectMetadata> {
    const query = {
      name: validateProjectName(name),
      template: templateId === undefined ? undefined : normalizeIdentifier(templateId),
    };
    return this.requestOp<ProjectMetadata>('POST', 'createProj', query, undefined, config);
  }

  async updateProject(
    id: string,
    metadata: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<ProjectMetadata> {
    const body = JSON.stringify(metadata ?? {});
    const mergedConfig = mergeHeaders(config, {'Content-Type': 'application/json'});
    return this.requestOp<ProjectMetadata>('POST', 'updateProj', {id: normalizeIdentifier(id)}, body, mergedConfig);
  }

  async deleteProject(id: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>('POST', 'deleteProj', {id: normalizeIdentifier(id)}, undefined, config);
  }

  async getGitInfo(id: string, config?: AxiosRequestConfig): Promise<GitInfo> {
    return this.requestOp<GitInfo>('GET', 'gitInfo', {id: normalizeIdentifier(id)}, undefined, config);
  }

  async initGit(id: string, config?: AxiosRequestConfig): Promise<GitInfo> {
    return this.requestOp<GitInfo>('POST', 'gitInit', {id: normalizeIdentifier(id)}, undefined, config);
  }

  async commitGit(id: string, message = '', config?: AxiosRequestConfig): Promise<GitCommit> {
    return this.requestOp<GitCommit>(
      'POST',
      'gitCommit',
      {id: normalizeIdentifier(id)},
      JSON.stringify({message}),
      config
    );
  }

  async getGitHistory(id: string, config?: AxiosRequestConfig): Promise<GitCommit[]> {
    return this.requestOp<GitCommit[]>('GET', 'gitHistory', {id: normalizeIdentifier(id)}, undefined, config);
  }

  async restoreGitFile(path: string, config?: AxiosRequestConfig): Promise<void> {
    await this.requestOp<void>('POST', 'gitRestore', {path: normalizeOpPath(path)}, undefined, config);
  }

  async exportProject(id: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<ArrayBuffer>> {
    const {params: configParams, responseType, headers: configHeaders, ...restConfig} = config;
    const params = mergeQuery(configParams, 'exportProj', {id: normalizeIdentifier(id)});
    const headerSource = configHeaders ? {headers: configHeaders} : undefined;
    const mergedHeaders = mergeHeaders(headerSource, {'Content-Type': 'application/json'}).headers;
    const finalConfig: AxiosRequestConfig = {
      ...restConfig,
      method: 'POST',
      url: '',
      params,
      responseType: responseType ?? 'arraybuffer',
      data: null,
    };
    if (mergedHeaders) {
      finalConfig.headers = mergedHeaders;
    }
    return this.axiosInstance.request<ArrayBuffer>(finalConfig);
  }

  async importProjects(payload: ImportPayload, config?: AxiosRequestConfig): Promise<ProjectMetadata[]> {
    const mergedConfig = mergeHeaders(config, {'Content-Type': 'application/octet-stream'});
    return this.requestOp<ProjectMetadata[]>('POST', 'importProj', {}, payload, mergedConfig);
  }

  private async requestOp<T>(
    method: 'GET' | 'POST',
    op: string,
    query: Record<string, unknown> = {},
    data?: unknown,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    return (await this.requestOpResponse<T>(method, op, query, data, config)).data;
  }

  private async requestOpResponse<T>(
    method: 'GET' | 'POST',
    op: string,
    query: Record<string, unknown> = {},
    data?: unknown,
    config: AxiosRequestConfig = {}
  ): Promise<AxiosResponse<T>> {
    const {params: configParams, data: configData, headers: configHeaders, ...restConfig} = config;
    const params = mergeQuery(configParams, op, query);

    let finalData = data ?? configData;
    const normalizeHeaders = (
      headers?: AxiosRequestConfig['headers']
    ): Record<string, AxiosHeaderValue> | undefined => {
      if (!headers) {
        return undefined;
      }
      const normalized = axios.AxiosHeaders.from(headers).toJSON();
      return normalized as Record<string, AxiosHeaderValue>;
    };

    let finalHeaders = normalizeHeaders(configHeaders);

    if (method === 'POST') {
      if (finalData === undefined) {
        finalData = null;
      }
      if (!finalHeaders) {
        finalHeaders = {} as Record<string, AxiosHeaderValue>;
      }
      const hasContentType = Object.keys(finalHeaders).some((key) => key.toLowerCase() === 'content-type');
      if (!hasContentType) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    }

    const finalConfig: AxiosRequestConfig = {
      ...restConfig,
      method,
      url: '',
      params,
      data: finalData,
    };

    if (finalHeaders) {
      finalConfig.headers = finalHeaders;
    }

    return this.axiosInstance.request<T>(finalConfig);
  }
}

function normalizeFilePath(path: string): string {
  const normalized = normalizeOpPath(path);
  return normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeOpPath(path: string): string {
  if (typeof path !== 'string') {
    throw new TypeError('Path is required');
  }
  const trimmed = path.trim().replace(/^\/+/, '');
  if (!trimmed) {
    throw new TypeError('Path is required');
  }
  return trimmed;
}

function normalizeIdentifier(value: string): string {
  if (typeof value !== 'string') {
    throw new TypeError('Identifier is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError('Identifier is required');
  }
  return trimmed;
}

function normalizeEntryName(name: string): string {
  if (typeof name !== 'string') {
    throw new TypeError('Name is required');
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new TypeError('Name is required');
  }
  if (trimmed.includes('/') || trimmed.includes(String.fromCharCode(92))) {
    throw new TypeError('Name cannot contain path separators');
  }
  return trimmed;
}

function validateProjectName(name: string): string {
  if (typeof name !== 'string') {
    throw new TypeError('Project name is required');
  }
  const trimmed = name.trim();
  if (!trimmed) {
    throw new TypeError('Project name is required');
  }
  return trimmed;
}

function mergeQuery(
  existingParams: AxiosRequestConfig['params'],
  op: string,
  query: Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {};

  if (existingParams instanceof URLSearchParams) {
    existingParams.forEach((value, key) => {
      params[key] = value;
    });
  } else if (existingParams && typeof existingParams === 'object') {
    for (const [key, value] of Object.entries(existingParams as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        params[key] = String(value);
      }
    }
  }

  params.op = op;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params[key] = typeof value === 'string' ? value : String(value);
  }

  return params;
}

function mergeHeaders(
  config: AxiosRequestConfig | undefined,
  headers: Record<string, AxiosHeaderValue>
): AxiosRequestConfig {
  const baseHeaders = axios.AxiosHeaders.from(config?.headers);
  for (const [key, value] of Object.entries(headers)) {
    baseHeaders.set(key, value);
  }
  const mergedHeaders = baseHeaders.toJSON() as Record<string, AxiosHeaderValue>;
  if (!config) {
    return {headers: mergedHeaders};
  }
  return {
    ...config,
    headers: mergedHeaders,
  };
}

export type {ImportPayload, TicloFileClientOptions, UploadOptions, UploadPayload};
export {TicloFileClient};
