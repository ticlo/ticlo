import type {Context} from 'hono';
import type {UserAuth} from './auth.ts';

type StorageContext = Context;
type AuthProvider = (request: StorageContext) => UserAuth | Promise<UserAuth>;

interface FileQuerystring {
  op?: string;
  path?: string;
  dest?: string;
  name?: string;
  exists?: string;
  crc?: string;
  id?: string;
  template?: string;
}

interface FileStorageOptions {
  prefix?: string;
  rootDir?: string;
  authProvider?: AuthProvider;
}

type StorageScope = 'proj' | 'usr';

interface ProjectMetadata extends Record<string, unknown> {
  id: string;
}

interface StoragePath {
  scope: StorageScope;
  id: string;
  relative: string;
  absolute: string;
  projectRoot: string;
  posixPath: string;
}

class StorageError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type {
  AuthProvider,
  FileQuerystring,
  FileStorageOptions,
  ProjectMetadata,
  StorageContext,
  StoragePath,
  StorageScope,
};
export {StorageError};
