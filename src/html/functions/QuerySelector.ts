import './registerArrow';
import {PureFunction, Functions, ErrorEvent} from '../../../src/core';

export class QuerySelectorFunction extends PureFunction {
  run() {
    let parent = this._data.getValue('parent');
    let query = this._data.getValue('query');
    if (typeof query === 'string') {
      if (parent === 'document') {
        parent = document;
      } else if (!(parent instanceof Element)) {
        parent = null;
      }
      if (parent) {
        try {
          this._data.output((parent as Element).querySelector(query));
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

Functions.add(
  QuerySelectorFunction,
  {
    name: 'query-selector',
    icon: 'fab:html5',
    properties: [
      {name: 'parent', type: 'none', init: 'document'},
      {name: 'query', type: 'string', pinned: true},
      {name: '#output', pinned: true, type: 'none', readonly: true},
    ],
  },
  'html'
);
