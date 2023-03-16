import {Request} from 'express';
import {Block, convertToObject, DataMap} from '../../src/core';
import {HttpRequest} from '../core/functions/web-server/HttpRequest';
import {number} from 'yargs';

export class ExpressHttpRequest extends HttpRequest {
  req: Request;
  constructor(req: Request, basePath: string) {
    let {method, url, path, body, query, headers} = req;
    super({method, url, body, query, headers, path: path.substring(basePath.length)});
    this.req = req;
  }

  onResolve(worker: Block, output: any): DataMap {
    let response = super.onResolve(worker, output);
    if (response) {
      let status = response.status || 200;
      let data = response.data;
      let headers = response.headers;
      if (headers) {
        this.req.res.set(convertToObject(headers));
      }
      if (data != null) {
        switch (typeof data) {
          case 'boolean':
          case 'bigint':
          case 'number':
            // Can not send number in response directly, it will be treated as status code.
            data = String(data);
            break;
          case 'string':
            break;
          case 'object':
            if (data.constructor !== Object && !(data instanceof Uint8Array)) {
              // invalid data type
              this.req.res.status(status).end();
              return;
            }
            break;
          default:
            // invalid data type
            this.req.res.status(status).end();
            return;
        }
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
