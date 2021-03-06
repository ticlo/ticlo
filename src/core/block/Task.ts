import {convertToOutput, DataMap} from '../util/DataTypes';
import {Block} from './Block';
import {ErrorEvent} from './Event';

export class Task {
  _handler: any = null;

  attachHandler(handler: any): boolean {
    if (this._handler) {
      return false;
    }
    this._handler = handler;
    return true;
  }

  getData() {
    return this;
  }

  getDataMap(): any {
    return null;
  }

  /**
   * called when the task is completed, it ignores the keepOrder parameter and called at the order flow is done, not the same order as emitted output
   * @param worker
   * @param output
   */
  onComplete(worker: Block, output: Block): DataMap {
    return convertToOutput(output);
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

  attachHandler(handler: any): boolean {
    return false;
  }

  getData() {
    return this.data;
  }
  getDataMap(): any {
    return this.data;
  }
}
