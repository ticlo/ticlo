import {BlockFunction} from '../../block/BlockFunction';
import {HttpRequest} from './HttpRequest';
import {Functions} from '../../block/Functions';

export class StaticResponse extends BlockFunction {
  _called: HttpRequest[] = [];
  onCall(val: any): boolean {
    if (val instanceof HttpRequest) {
      this._called.push(val);
      return true;
    }
    return false;
  }

  run(): any {
    for (let request of this._called) {
      if (request.attachHandler(this)) {
        request.onComplete(this._data, this._data);
      }
    }
    this._called.length = 0;
  }
}

Functions.add(
  StaticResponse,
  {
    name: 'static-response',
    icon: 'fas:network-wired',
    mode: 'onCall',
    properties: [
      {name: 'data', type: 'any', pinned: true},
      {name: 'headers', type: 'object', pinned: true},
      {name: 'status', type: 'number', min: 200, max: 999, step: 1, default: 200},
    ],
  },
  'http'
);
