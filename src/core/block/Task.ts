import {convertToObject, DataMap} from '../util/DataTypes';
import {Block, Job} from './Block';
import {ErrorEvent} from './Event';

export class Task {
  _handler: any = null;

  attachHandler(handler: any) {
    this._handler = handler;
  }

  getData() {
    return this;
  }

  getDataMap(): any {
    return null;
  }

  /**
   * called when the task is completed, it ignores the keepOrder parameter and called at the order job is done, not the same order as emitted output
   * @param worker
   * @param output
   */
  onComplete(worker: Job, output: any): DataMap {
    return convertToObject(output);
  }

  onTimeout(): any {
    return new ErrorEvent('timeout');
  }

  onCancel(): void {}
}

export class DefaultTask extends Task {
  data: any;

  constructor(data: any) {
    super();
    this.data = data;
  }

  getData() {
    return this.data;
  }
  getDataMap(): any {
    return this.data;
  }
}
