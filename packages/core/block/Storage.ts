import {Flow, FlowLoader, Root} from './Flow.ts';
import {DataMap} from '../util/DataTypes.ts';
import {BlockProperty} from './BlockProperty.ts';

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

  // REFACTOR(design.md): MUST save a versioned graph with fixed block types and explicit wire records.
  saveFlow(flow: Flow | null, data: DataMap | null, key: string): any;

  // REFACTOR(design.md): MUST reject unsupported versions or run an explicit format migration.
  loadFlow(name: string): Promise<DataMap | null>;

  hasLocalBackup?(name: string): boolean;

  initLibrary?: (libraryId: string) => any;

  saveModule(libraryId: string, module: string, data: DataMap): any;

  loadModule(libraryId: string, module: string): Promise<DataMap | null>;

  inited?: boolean;
  init(root: Root): unknown; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(key: string, prop: BlockProperty): FlowLoader;
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
