import {Task} from '../../block/Task.js';
import {Block} from '../../block/Block.js';
import {convertToOutput, DataMap} from '../../util/DataTypes.js';
import {ErrorEvent} from '../../block/Event.js';

export interface HttpRequestData {
  method: string;
  url: string;
  path: string;
  body: any;
  query: {[key: string]: any};
  headers: {[key: string]: string | string[]};
}

export class HttpRequest extends Task {
  constructor(public data: HttpRequestData) {
    super();
  }

  getDataMap(): any {
    return this.data;
  }

  onResolve(worker: Block, output: any): DataMap {
    return convertToOutput(output);
  }

  onTimeout(): any {
    return new ErrorEvent('timeout');
  }

  onCancel(): void {}
}
