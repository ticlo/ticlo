import {Flow, FlowLoader, Root} from './Flow';
import {DataMap} from '../util/DataTypes';
import {BlockProperty} from './BlockProperty';

export interface Storage {
  deleteFlow(name: string): void;

  saveFlow(name: string, flow: Flow, data: DataMap): void;

  loadFlow(name: string): Promise<DataMap>;

  inited?: boolean;
  init(root: Root): any; // void or promise

  // return [applyChange,onStateChange] of a flow
  getFlowLoader(name: string, prop: BlockProperty): FlowLoader;
}
