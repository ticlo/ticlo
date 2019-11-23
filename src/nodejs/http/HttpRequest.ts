import {Task} from '../../core/block/Task';
import {Block} from '../../core/block/Block';
import {convertToObject, DataMap} from '../../core/util/DataTypes';
import {ErrorEvent} from '../../core/block/Event';

export interface HttpRequestData {
  method: string;
  url: string;
  path: string;
  body: any;
  query: {[key: string]: string | string[]};
  headers: {[key: string]: string | string[]};
}

export class HttpRequest extends Task {
  constructor(public data: HttpRequestData) {
    super();
  }

  getDataMap(): any {
    return this.data;
  }

  onComplete(worker: Block, output: Block): DataMap {
    return convertToObject(output);
  }

  onTimeout(): any {
    return new ErrorEvent('timeout');
  }

  onCancel(): void {}
}
