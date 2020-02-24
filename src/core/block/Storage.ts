import {Job, Root} from './Job';
import {DataMap} from '../util/DataTypes';

export interface Storage {
  deleteJob(name: string): void;

  saveJob(name: string, job: Job, data: DataMap): void;

  init(root: Root): void;
}
