import axios, {AxiosResponse, CanceledError} from 'axios';
import {BaseFunction, BlockFunction} from '../../block/BlockFunction';
import {ErrorEvent, EventType, WAIT} from '../../block/Event';
import {Functions} from '../../block/Functions';
import {BlockMode} from '../../block/Block';

export type RouteContentType = 'empty' | 'text' | 'json' | 'buffer' | 'form';
const contentTypeList: RouteContentType[] = ['empty', 'text', 'json', 'buffer', 'form'];

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
const methodList: RouteMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

const responseTypeList = ['arraybuffer', 'blob', 'document', 'json', 'text'];

export class FetchFunction extends BaseFunction {
  _abortController: AbortController;

  run(): any {
    let url = this._data.getValue('url');
    if (typeof url === 'string' && url) {
      // cancel the previous request
      this._abortController?.abort();
      this._abortController = new AbortController();
      return axios({
        url,
        method: this._data.getValue('method'),
        headers: this._data.getValue('requestHeaders'),
        data: this._data.getValue('requestBody'),
        responseType: this._data.getValue('responseType'),
        withCredentials: this._data.getValue('withCredentials'),
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
          this._data.output(undefined, 'status');
          this._data.output(undefined, 'responseHeaders');
          this._data.output(undefined);
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
    properties: [
      {name: 'url', type: 'string', pinned: true},
      {name: 'method', type: 'select', options: methodList, default: 'GET', pinned: true},
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
