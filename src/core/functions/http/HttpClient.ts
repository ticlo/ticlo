import {URL} from 'url';
import axios, {AxiosPromise, AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse} from 'axios';
import {ImpureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {isDataMap} from '../../util/DataTypes';

export interface HttpClient {
  request(config: AxiosRequestConfig): Promise<AxiosResponse>;
}

function adjustRequestHeaders(config: AxiosRequestConfig) {
  if (config.data) {
    if (!(config.headers?.['Content-Type'] || config.headers?.['content-type'])) {
      const headers = {...config.headers};
      if (typeof config.data === 'string') {
        headers['content-type'] = 'text/plain';
      } else if (typeof config.data === 'object') {
        if (config.data instanceof Uint8Array) {
          headers['content-type'] = 'application/octet-stream';
        } else {
          headers['content-type'] = 'application/json';
        }
      }
      return {...config, headers};
    }
  }
  return config;
}

export function httpRequest(config: AxiosRequestConfig) {
  return axios(adjustRequestHeaders(config));
}

export const axiosClient: HttpClient = {
  request(config: AxiosRequestConfig) {
    return httpRequest(config);
  },
};

class HttpClientObject implements HttpClient {
  readonly baseUrl: string;
  readonly headers?: AxiosRequestHeaders;
  readonly optionalHeaders?: AxiosRequestHeaders;

  constructor(baseUrl: unknown, headers?: unknown, optionalHeaders?: unknown) {
    if (typeof baseUrl === 'string') {
      this.baseUrl = baseUrl;
    }
    if (isDataMap(headers)) {
      this.headers = headers as AxiosRequestHeaders;
    }
    if (isDataMap(optionalHeaders)) {
      this.optionalHeaders = optionalHeaders as AxiosRequestHeaders;
    }
  }

  async request(config: AxiosRequestConfig) {
    let url = config.url;
    // don't allow parent path
    if (url.startsWith('/')) {
      url = url.replace(/\/+/, '');
    }
    url = new URL(url, this.baseUrl).href;
    if (!url.startsWith(this.baseUrl)) {
      throw new Error(`Invalid Url: ${url}`);
    }
    let headers = config.headers;
    if (this.headers || this.optionalHeaders) {
      headers = {...this.optionalHeaders, ...headers, ...this.headers};
    }

    return httpRequest({...config, url, headers});
  }
}

class HttpClientFunction extends ImpureFunction {
  run(): any {
    let url = this._data.getValue('url');
    let headers = this._data.getValue('headers');
    let optionalHeaders = this._data.getValue('optionalHeaders');
    this._data.output(new HttpClientObject(url, headers, optionalHeaders));
  }
}

Functions.add(
  HttpClientFunction,
  {
    name: 'client',
    icon: 'fas:file-arrow-down',
    mode: 'onLoad',
    priority: 0,
    properties: [
      {name: 'url', type: 'string', pinned: true},
      {name: 'headers', type: 'object', create: 'http:create-headers'},
      {name: 'optionalHeaders', type: 'object', create: 'http:create-headers'},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
    tags: ['http-client'],
  },
  'http'
);
