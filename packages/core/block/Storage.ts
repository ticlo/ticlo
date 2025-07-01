import {Flow, FlowLoader, Root} from './Flow';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from './BlockProperty';

export interface Storage {
  delete(key: string): void;

  save(key: string, data: string): void;

  load(key: string): Promise<string>;

  listen(key: string, listener: (val: string) => void): void;

  unlisten(key: string, listener: (val: string) => void): void;
}

export interface FlowStorage {
  delete(name: string): void;

  saveFlow(flow: Flow, data: DataMap, overrideKey?: string): void;

  loadFlow(name: string): Promise<DataMap | null>;

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
