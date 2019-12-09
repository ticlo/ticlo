import './registerJsonEsc';
import {BaseFunction} from '../../core/block/BlockFunction';
import {Types} from '../../core/block/Type';
import {ErrorEvent} from '../../core/block/Event';

export class QuerySelectorFunction extends BaseFunction {
  run() {
    let parent = this._data.getValue('parent');
    let query = this._data.getValue('query');
    if (query) {
      if (parent === null) {
        parent = document;
      } else if (!(parent instanceof Element)) {
        parent = null;
      }
      if (parent) {
        try {
          this._data.output(parent.querySelector(query));
          return;
        } catch (e) {
          this._data.output(undefined);
          return new ErrorEvent('error', e);
        }
      }
    }
    this._data.output(undefined);
  }
}

Types.add(
  QuerySelectorFunction,
  {
    name: 'query-selector',
    icon: 'fab:html5',
    properties: [
      {name: 'parent', type: 'none', init: null},
      {name: 'query', type: 'string'},
      {name: 'output', type: 'none', readonly: true}
    ]
  },
  'dom'
);
