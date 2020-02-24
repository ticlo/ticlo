import {Job, Root} from './Job';
import {DataMap} from '../util/DataTypes';

export interface DataLoader {
  deleteJob(name: string, job: Job): void;

  saveJob(name: string, job: Job, data: DataMap): void;

  init(root: Root): void;
}
