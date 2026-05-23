import {Block, convertToObject, DataMap} from '@ticlo/core';
import {HttpRequest as BaseHttpRequest} from '@ticlo/core/functions/web-server/HttpRequest.js';

export interface HonoRequestData {
  method: string;
  url: string;
  body?: any;
  query: {[key: string]: string};
  headers: {[key: string]: string};
  getBody(): Promise<any>;
}

export class HonoResponse {
  private _headers = new Headers();
  private _status = 200;
  private _sent = false;
  private _resolve!: (response: Response) => void;

  response: Promise<Response>;

  constructor() {
    this.response = new Promise<Response>((resolve) => {
      this._resolve = resolve;
    });
  }

  code(status: number) {
    this._status = status;
    return this;
  }

  status(status: number) {
    return this.code(status);
  }

  header(key: string, value: unknown) {
    this._headers.set(key, String(value));
    return this;
  }

  send(data?: any) {
    if (this._sent) {
      return;
    }
    this._sent = true;

    let body: BodyInit | null = null;
    if (data != null) {
      if (typeof data === 'string' || data instanceof ArrayBuffer) {
        body = data;
      } else if (data instanceof Uint8Array) {
        body = data.slice().buffer;
      } else {
        if (!this._headers.has('Content-Type')) {
          this._headers.set('Content-Type', 'application/json');
        }
        body = JSON.stringify(data);
      }
    }

    this._resolve(new Response(body, {status: this._status, headers: this._headers}));
  }
}

export class HttpRequest extends BaseHttpRequest {
  req: HonoRequestData;
  res: HonoResponse;

  constructor(req: HonoRequestData, res: HonoResponse, basePath: string) {
    const {method, url, body, query, headers} = req;
    // Extract path from URL, removing query parameters
    let path = url || '';
    const queryIndex = path.indexOf('?');
    if (queryIndex !== -1) {
      path = path.substring(0, queryIndex);
    }

    super({
      method,
      url,
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
