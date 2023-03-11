import {URL} from 'url';
import axios, {AxiosPromise, AxiosRequestConfig, AxiosRequestHeaders} from 'axios';
import {ImpureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';

export interface HttpClient {
  request(config: AxiosRequestConfig): AxiosPromise;
}

export const axiosClient: HttpClient = {
  request(config: AxiosRequestConfig) {
    return axios(config);
  },
};

class HttpClientObject implements HttpClient {
  readonly baseUrl: string;
  readonly headers?: AxiosRequestHeaders;
  readonly optionalHeaders?: AxiosRequestHeaders;

  constructor(baseUrl: string, headers?: AxiosRequestHeaders, optionalHeaders?: AxiosRequestHeaders) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.optionalHeaders = optionalHeaders;
  }

  request(config: AxiosRequestConfig): AxiosPromise {
    const url = new URL(config.url, this.baseUrl).href;
    let headers = config.headers;
    if (this.headers || this.optionalHeaders) {
      headers = {...this.optionalHeaders, ...headers, ...this.headers};
    }
    return axios({...config, url, headers});
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
