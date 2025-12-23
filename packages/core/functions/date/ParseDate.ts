import {PureFunction} from '../../block/BlockFunction.js';
import {Functions} from '../../block/Functions.js';
import {toDateTime} from '../../util/DateTime.js';

export class ParseDateFunction extends PureFunction {
  run() {
    const input = this._data.getValue('input');
    let d = toDateTime(input);
    if (d.isValid) {
      this._data.output(d);
      this._data.output(d.year, 'year');
      this._data.output(d.month, 'month');
      this._data.output(d.day, 'day');
      this._data.output(d.hour, 'hour');
      this._data.output(d.minute, 'minute');
      this._data.output(d.second, 'second');
      this._data.output(d.millisecond, 'millisecond');
      this._data.output(d.weekday, 'weekday');
      this._data.output(d.valueOf(), 'timestamp');
      this._data.output(d.zoneName, 'timezone');
      return;
    }
    this._data.output(null);
    this._data.output(null, 'year');
    this._data.output(null, 'month');
    this._data.output(null, 'date');
    this._data.output(null, 'day');
    this._data.output(null, 'hour');
    this._data.output(null, 'minute');
    this._data.output(null, 'second');
    this._data.output(null, 'millisecond');
    this._data.output(null, 'weekday');
    this._data.output(null, 'timestamp');
    this._data.output(null, 'timezone');
  }
}

Functions.add(
  ParseDateFunction,
  {
    name: 'parse',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'input', type: 'any', pinned: true},
      {name: 'year', type: 'number', readonly: true, pinned: true},
      {name: 'month', type: 'number', readonly: true, pinned: true},
      {name: 'day', type: 'number', readonly: true, pinned: true},
      {name: 'hour', type: 'number', readonly: true, pinned: true},
      {name: 'minute', type: 'number', readonly: true, pinned: true},
      {name: 'second', type: 'number'},
      {name: 'millisecond', type: 'number'},
      {name: 'weekday', type: 'number', readonly: true},
      {name: 'timestamp', type: 'number', readonly: true},
      {name: 'timezone', type: 'string', readonly: true},
      {name: '#output', type: 'date', pinned: true, readonly: true},
    ],
  },
  'date'
);
