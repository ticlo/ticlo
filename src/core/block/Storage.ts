import {Flow, Root} from './Flow';
import {DataMap} from '../util/DataTypes';

export interface Storage {
  deleteFlow(name: string): void;

  saveFlow(name: string, flow: Flow, data: DataMap): void;

  init(root: Root): any; // void or promise
}
