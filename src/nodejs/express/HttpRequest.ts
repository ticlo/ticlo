import {HttpRequest} from '../http/HttpRequest';
import {Request, Response, RequestHandler} from 'express';
import {Block} from '../../core/block/Block';
import {DataMap} from '../../core/util/DataTypes';

export class ExpressHttpRequest extends HttpRequest {
  data: Request;
  constructor(req: Request) {
    super(req);
  }

  onComplete(worker: Block, output: Block): DataMap {
    let response = super.onComplete(worker, output);
    let status = response.status || 200;
    let data = response.data;
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
