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
  delete(name: string): void | Promise<void>;

  saveFlow(flow: Flow | null, data: DataMap | null, key: string): any;

  loadFlow(name: string): Promise<DataMap | null>;

  initNamespace?: (ns: string) => any;

  saveLib(ns: string, lib: string, data: DataMap): any;

  loadLib(ns: string, lib: string): Promise<DataMap | null>;

  inited?: boolean;
  init(root: Root): unknown; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(key: string, prop: BlockProperty): FlowLoader;
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
