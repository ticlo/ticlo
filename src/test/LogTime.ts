import {Functions, PureFunction} from '../core';

export class LogTimeFunction extends PureFunction {
  run() {
    if (this._data.getValue('always') || this._data.getValue('#output') === undefined) {
      this._data.output(new Date().getTime());
    }
  }
}

Functions.add(
  LogTimeFunction,
  {
    name: 'log-time',
    priority: 0,
    mode: 'onCall',
    properties: [
      {name: 'always', type: 'toggle'},
      {name: '#output', type: 'toggle', readonly: true, pinned: true},
    ],
    dynamicStyle: true,
  },
  'test'
);
