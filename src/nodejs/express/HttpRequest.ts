import {HttpRequest} from '../../core/functions/http/HttpRequest';
import {Request} from 'express';
import {Block} from '../../core/block/Block';
import {convertToObject, DataMap} from '../../core/util/DataTypes';

export class ExpressHttpRequest extends HttpRequest {
  data: Request;
  constructor(req: Request) {
    super(req);
  }

  onComplete(worker: Block, output: Block): DataMap {
    let response = super.onComplete(worker, output);
    let status = response.status || 200;
    let data = response.data;
    let headers = response.headers;
    if (headers) {
      this.data.res.set(convertToObject(headers));
    }
    this.data.res.status(status).send(data);
    return response;
  }

  onTimeout(): any {
    this.data.res.status(500).send('timeout');
    return super.onTimeout();
  }

  onCancel(): void {
    this.data.res.status(500).send('canceled');
  }
}
