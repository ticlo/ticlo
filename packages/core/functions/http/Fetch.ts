import axios, {AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse, CanceledError, ResponseType} from 'axios';
import {PureFunction, StatefulFunction, BaseFunction} from '../../block/BlockFunction';
import {ErrorEvent, EventType, WAIT} from '../../block/Event';
import {Functions} from '../../block/Functions';
import {defaultConfigs, BlockMode} from '../../block/Descriptor';
import {httpRequest, type HttpClient} from './HttpClient';
import {DataMap} from '../../util/DataTypes';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
const methodList: RouteMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

const responseTypeList = ['arraybuffer', 'blob', 'document', 'json', 'text'];

const httpClient: HttpClient = {
  async request(config: AxiosRequestConfig) {
    const url = config.url;
    if (typeof url !== 'string' || !(url.startsWith('https://') || url.startsWith('http://'))) {
      throw new Error(`Invalid Url: ${url}`);
    }
    return httpRequest(config);
  },
};

export class FetchFunction extends BaseFunction {
  _abortController: AbortController;

  run(): any {
    let client: HttpClient = this._data.getValue('client') as HttpClient;
    let url = this._data.getValue('url');
    if (typeof url === 'string' && url) {
      // cancel the previous request
      this._abortController?.abort();
      this._abortController = new AbortController();
      if (typeof client?.request !== 'function') {
        client = httpClient;
      }
      return client
        .request({
          url,
          method: this._data.getValue('method')?.toString(),
          params: this._data.getValue('params'),
          headers: this._data.getValue('requestHeaders') as AxiosRequestHeaders,
          data: this._data.getValue('requestBody'),
          responseType: this._data.getValue('responseType') as ResponseType,
          withCredentials: Boolean(this._data.getValue('withCredentials')),
          signal: this._abortController.signal,
        })
        .then((response: AxiosResponse) => {
          this._data.output(response.status, 'status');
          this._data.output({...response.headers}, 'responseHeaders');
          this._data.output(response.data);
        })
        .catch((error) => {
          if (error.response) {
            this._data.output(error.response.status, 'status');
            this._data.output({...error.response.headers}, 'responseHeaders');
            this._data.output(error.response.data);
            throw error.response;
          }
          if (error instanceof CanceledError) {
            // don't throw
            return;
          }
          this.cleanup();
          throw error;
        });
    }
    return new ErrorEvent('invalid url');
  }

  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto') {
    if (this._abortController?.signal.aborted === false) {
      this._abortController?.abort();
    }
    return true;
  }

  cleanup(): void {
    this._data.output(undefined, 'status');
    this._data.output(undefined, 'responseHeaders');
    this._data.output(undefined);
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

Functions.add(
  FetchFunction,
  {
    name: 'fetch',
    icon: 'fas:file-arrow-down',
    mode: 'onLoad',
    priority: 2,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'client', type: 'service', options: ['http-client']},
      {name: 'url', type: 'string', pinned: true},
      {name: 'method', type: 'select', options: methodList, default: 'GET', pinned: true},
      {name: 'params', type: 'object', create: 'create-object'},
      {name: 'requestHeaders', type: 'object', create: 'http:create-headers'},
      {name: 'requestBody', type: 'any'},
      {name: 'withCredentials', type: 'toggle'},
      {name: 'responseType', type: 'select', options: responseTypeList},
      {name: 'responseHeaders', type: 'object', readonly: true},
      {name: 'status', type: 'number', readonly: true},
      {name: '#output', type: 'any', readonly: true, pinned: true},
    ],
  },
  'http'
);
