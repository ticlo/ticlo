import {Task} from '../../block/Task';
import {Block} from '../../block/Block';
import {convertToOutput, DataMap} from '../../util/DataTypes';
import {ErrorEvent} from '../../block/Event';

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
