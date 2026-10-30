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
  getNamespaceMetadata?(namespace: string): Promise<NamespaceMetadata>;
  saveNamespaceMetadata?(namespace: string, metadata: NamespaceMetadata): Promise<void>;
  listFlows?(namespace: string, folders?: string[]): Promise<string[]>;
  readonly persistent?: boolean;
  isPersistent?(namespace: string): boolean;
  canWriteFlow?(key: string): boolean;
  getValueStorage?(namespace: string): Storage;
  delete(name: string): void | Promise<void>;

  createFolder?(name: string): void | Promise<void>;

  deleteFolder?(name: string): void | Promise<void>;

  // REFACTOR(design.md): MUST save a versioned graph with fixed block types and explicit wire records.
  saveFlow(flow: Flow | null, data: DataMap | null, key: string): any;

  // REFACTOR(design.md): MUST reject unsupported versions or run an explicit format migration.
  loadFlow(name: string): Promise<DataMap | null>;

  initNamespace?: (ns: string) => any;

  saveLib(ns: string, lib: string, data: DataMap): any;

  loadLib(ns: string, lib: string): Promise<DataMap | null>;

  inited?: boolean;
  init(root: Root): unknown; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(key: string, prop: BlockProperty): FlowLoader;
}

export interface NamespaceMetadata {
  dependencies?: string[];
  serviceLibraries?: string[];
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
