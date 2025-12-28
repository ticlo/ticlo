import {FastifyRequest, FastifyReply} from 'fastify';
import {Block, convertToObject, DataMap} from '@ticlo/core';
import {HttpRequest as BaseHttpRequest} from '@ticlo/core/functions/web-server/HttpRequest.js';

export class HttpRequest extends BaseHttpRequest {
  req: FastifyRequest;
  res: FastifyReply;

  constructor(req: FastifyRequest, res: FastifyReply, basePath: string) {
    const {method, url, body, query, headers} = req;
    // Extract path from URL, removing query parameters
    let path = url || req.raw.url || '';
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }

    super({
      method,
      url: url || req.raw.url || '',
      body,
      query,
      headers,
      path: path.substring(basePath.length),
    });
    this.req = req;
    this.res = res;
  }

  onResolve(worker: Block, output: any): DataMap {
    const response = super.onResolve(worker, output);
    if (response) {
      const status = typeof response.status === 'number' ? response.status : 200;
      let data = response.data;
      const headers = response.headers;

      if (headers) {
        const headerObj = convertToObject(headers);
        for (const [key, value] of Object.entries(headerObj)) {
          this.res.header(key, value);
        }
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
              this.res.code(status).send();
              return;
            }
            break;
          default:
            // invalid data type
            this.res.code(status).send();
            return;
        }
      }

      this.res.code(status).send(data);
    } else {
      this.res.code(501).send();
    }
    return response;
  }

  onTimeout(): any {
    this.res.code(500).send('timeout');
    return super.onTimeout();
  }

  onCancel(): void {
    this.res.code(500).send('canceled');
  }
}
