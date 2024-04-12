import dayjs from 'dayjs';
import {PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {createDayjs} from '../../util/Dayjs';

export class ParseDateFunction extends PureFunction {
  run() {
    const input = this._data.getValue('input');
    let d: dayjs.Dayjs;
    if (dayjs.isDayjs(input)) {
      d = input;
    } else {
      d = dayjs(input as any);
    }
    if (d.isValid()) {
      let m: RegExpMatchArray;
      if (typeof input === 'string') {
        m = /[+\-]\d\d:\d\d$/.exec(input);
        if (m) {
          d = d.utcOffset(m[0]);
        }
      }
      this._data.output(d);
      this._data.output(d.year(), 'year');
      this._data.output(d.month(), 'month');
      this._data.output(d.date(), 'date');
      this._data.output(d.day(), 'day');
      this._data.output(d.hour(), 'hour');
      this._data.output(d.minute(), 'minute');
      this._data.output(d.second(), 'second');
      this._data.output(d.millisecond(), 'millisecond');
      if (m) {
        this._data.output(m[0], 'timezone');
      } else {
        this._data.output(d.format('Z'), 'timezone');
      }
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
    this._data.output(null, 'timezone');
  }
}

Functions.add(ParseDateFunction, {
  name: 'parse-date',
  icon: 'fas:clock',
  priority: 0,
  properties: [
    {name: 'input', type: 'any', pinned: true},
    {name: 'year', type: 'number', readonly: true, pinned: true},
    {name: 'month', type: 'number', readonly: true, pinned: true},
    {name: 'date', type: 'number', readonly: true, pinned: true},
    {name: 'hour', type: 'number', readonly: true, pinned: true},
    {name: 'minute', type: 'number', readonly: true, pinned: true},
    {name: 'second', type: 'number', readonly: true},
    {name: 'millisecond', type: 'number', readonly: true},
    {name: 'timezone', type: 'string', readonly: true},
    {name: '#output', type: 'date', pinned: true, readonly: true},
  ],
  category: 'date',
});
