import {WsBrowserConnection} from './WsBrowserConnection.ts';
import {DataMap, encode, decode} from '@ticlo/core';
import {ClientCallbacks} from '@ticlo/core/connect/ClientRequests.ts';
import axios from 'axios';

export class MixedBrowserConnection extends WsBrowserConnection {
  constructor(
    private readonly _httpUrl: string,
    editorListeners = true
  ) {
    super(_httpUrl.replace(/^http/, 'ws'), editorListeners);
  }
  _sendLargeData(data: DataMap, c: ClientCallbacks = null): Promise<any> | null {
    const {promise, callbacks} = this._initSimpleRequest(c);
    axios
      .post(this._httpUrl, encode(data), {
        headers: {'Content-Type': 'application/json'},
        transformResponse: [(data) => (typeof data === 'string' && data ? decode(data) : data)],
      })
      .then((response) => {
        if (response.data.cmd === 'error') {
          if (response.data.error) callbacks.onError?.(response.data.msg, {...data, error: response.data.error});
          else callbacks.onError?.(response.data.msg);
        } else {
          callbacks.onUpdate?.(response.data);
          callbacks.onDone?.();
        }
      })
      .catch((err) => {
        callbacks.onError?.(err.toString());
      });
    return promise;
  }

  protected sendRequest(data: DataMap, c?: ClientCallbacks): Promise<any> | string {
    const {cmd} = data;
    switch (cmd) {
      case 'get':
      case 'set':
      case 'update': {
        return this._sendLargeData(data, c) ?? '';
      }
      case 'executeCommand': {
        if (data.largeData) return this._sendLargeData(data, c) ?? '';
        break;
      }
    }
    return super.sendRequest(data, c);
  }
}
