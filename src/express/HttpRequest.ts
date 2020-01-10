import {Request} from 'express';
import {Block, convertToObject, DataMap} from '../../src/core/main';
import {HttpRequest} from '../../src/core/functions/http/HttpRequest';

export class ExpressHttpRequest extends HttpRequest {
  req: Request;
  constructor(req: Request, basePath: string) {
    let {method, url, path, body, query, headers} = req;
    super({method, url, body, query, headers, path: path.substring(basePath.length)});
    this.req = req;
  }

  onComplete(worker: Block, output: Block): DataMap {
    let response = super.onComplete(worker, output);
    if (response) {
      let status = response.status || 200;
      let data = response.data;
      let headers = response.headers;
      if (headers) {
        this.req.res.set(convertToObject(headers));
      }
      this.req.res.status(status).send(data);
    } else {
      this.req.res.status(501).end();
    }
    return response;
  }

  onTimeout(): any {
    this.req.res.status(500).send('timeout');
    return super.onTimeout();
  }

  onCancel(): void {
    this.req.res.status(500).send('canceled');
  }
}
