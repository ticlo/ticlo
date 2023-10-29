import {Flow, FlowLoader, Root} from './Flow';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from './BlockProperty';

export interface Storage {
  deleteFlow(name: string): void;

  saveFlow(flow: Flow, data: DataMap, overrideKey?: string): void;

  loadFlow(name: string): Promise<DataMap>;

  inited?: boolean;
  init(root: Root): any; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(key: string, prop: BlockProperty): FlowLoader;
}
