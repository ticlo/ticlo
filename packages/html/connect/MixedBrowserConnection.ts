import {WsBrowserConnection} from './WsBrowserConnection';
import {DataMap, encode} from '@ticlo/core';
import {ClientCallbacks} from '@ticlo/core/connect/ClientRequests';
import axios from 'axios';
import {measureObjSize, WS_FRAME_SIZE} from '@ticlo/core/util/DataTypes';

export class MixedBrowserConnection extends WsBrowserConnection {
  constructor(
    private readonly _httpUrl: string,
    editorListeners = true
  ) {
    super(_httpUrl.replace(/^http/, 'ws'), editorListeners);
  }
  _sendLargeData(data: DataMap, c: ClientCallbacks = null): Promise<any> | null {
    let {promise, callbacks} = this._initSimpleRequest(c);
    axios
      .post(this._httpUrl, encode(data), {headers: {'Content-Type': 'application/json'}})
      .then((response) => {
        if (response.data.cmd === 'error') {
          callbacks.onError?.(response.data.message);
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

  simpleRequest(data: DataMap): Promise<any>;
  simpleRequest(data: DataMap, c: ClientCallbacks): string;
  simpleRequest(data: DataMap, c?: ClientCallbacks): Promise<any> | string {
    const {cmd} = data;
    switch (cmd) {
      // case 'get': {
      //   break;
      // }
      case 'get':
      case 'set':
      case 'update': {
        return this._sendLargeData(data, c) ?? '';
      }
      case 'executeCommand': {
        return this._sendLargeData(data, c) ?? '';
      }
    }
    return super.simpleRequest(data, c);
  }
}
