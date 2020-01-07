import './registerJsonEsc';
import {BaseFunction} from '../../../src/core/block/BlockFunction';
import {Types} from '../../../src/core/block/Type';
import {ErrorEvent} from '../../../src/core/block/Event';

export class QuerySelectorFunction extends BaseFunction {
  run() {
    let parent = this._data.getValue('parent');
    let query = this._data.getValue('query');
    if (query) {
      if (parent === 'document') {
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
      {name: 'parent', type: 'none', init: 'document'},
      {name: 'query', type: 'string', visible: 'high'},
      {name: 'output', type: 'none', readonly: true}
    ]
  },
  'dom'
);
