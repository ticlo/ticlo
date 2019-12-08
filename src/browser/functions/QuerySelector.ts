import {BaseFunction} from '../../core/block/BlockFunction';
import {Types} from '../../core/block/Type';
import {ErrorEvent} from '../../core/block/Event';

export class QuerySelectorFunction extends BaseFunction {
  run() {
    let query = this._data.getValue('query');
    if (query) {
      try {
        this._data.output(document.querySelector(query));
      } catch (e) {
        this._data.output(undefined);
        return new ErrorEvent('error', e);
      }
    } else {
      this._data.output(undefined);
    }
  }
}

Types.add(
  QuerySelectorFunction,
  {
    name: 'query-selector',
    icon: 'fab:html5',
    properties: [
      {name: 'query', type: 'string'},
      {name: 'output', type: 'string', readonly: true}
    ]
  },
  'dom'
);
