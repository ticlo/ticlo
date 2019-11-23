import {BlockFunction} from '../../core/block/BlockFunction';
import {Event} from '../../core/block/Event';
import {HttpRequest} from './HttpRequest';
import {Types} from '../../core/block/Type';
import {HandlerFunction} from '../../core/worker/HandlerFunction';

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

Types.add(
  StaticResponse,
  {
    name: 'static-response',
    icon: 'fas:grip-lines-vertical',
    mode: 'onCall',
    properties: [
      {name: 'data', type: 'any'},
      {name: 'headers', type: 'map'},
      {name: 'status', type: 'number', min: 200, max: 999, step: 1, default: 200}
    ]
  },
  'http'
);