import {Flow, FlowLoader, Root} from './Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {BlockProperty} from './BlockProperty.ts';
import type {FileReadResult, FileRequest} from '../storage/FileAccess.ts';

export interface Storage {
  delete(key: string): void | Promise<void>;

  save(key: string, data: string): void | Promise<void>;

  load(key: string): Promise<string>;

  listen(key: string, listener: (val: string) => void): void;

  unlisten(key: string, listener: (val: string) => void): void;
}

export interface FlowStorage {
  /** Metadata and catalog reads must not instantiate flows. */
  getLibraryMetadata?(library: string): Promise<LibraryMetadata>;
  saveLibraryMetadata?(library: string, metadata: LibraryMetadata): Promise<void>;
  listFlows?(library: string, folders?: string[]): Promise<string[]>;
  readonly persistent?: boolean;
  isPersistent?(library: string): boolean;
  canWriteFlow?(key: string): boolean;
  getValueStorage?(library: string): Storage;
  delete(name: string): void | Promise<void>;

  createFolder?(name: string): void | Promise<void>;

  deleteFolder?(name: string): void | Promise<void>;

  saveFlow(flow: Flow | null, data: DataMap | null, key: string): any;

  loadFlow(name: string): Promise<DataMap | null>;

  hasLocalBackup?(name: string): boolean;

  initLibrary?: (libraryId: string) => any;

  saveModule(libraryId: string, module: string, data: DataMap): any;

  loadModule(libraryId: string, module: string): Promise<DataMap | null>;

  inited?: boolean;
  init(root: Root): unknown; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(key: string, prop: BlockProperty): FlowLoader;

  /** Resolve a file-path string to a local path (Node) or URL (browser). */
  resolveFilePath?(path: string, library?: string): string | undefined | Promise<string | undefined>;

  /** Resolve a file-path string to a URL (browser or HTTP-exposed Node storage). */
  resolveFileUrl?(path: string, library?: string): string | undefined | Promise<string | undefined>;

  /** Asynchronously read a file-path into a unified FileReadResult across browser and Node. */
  readFile?(path: string, library?: string, options?: FileRequest): Promise<FileReadResult>;
}

export interface LibraryMetadata {
  dependencies?: string[];
  autoLoadModules?: string[];
  autoLoadFlows?: string[];
}

export const voidStorage = {
  delete(key: string) {},

  save(key: string, data: string) {},

  async load(key: string): Promise<string> {
    return '';
  },

  listen(key: string, listener: (val: string) => void) {},

  unlisten(key: string, listener: (val: string) => void) {},
};
