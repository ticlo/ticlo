import {PureFunction} from '../../block/BlockFunction.js';
import {globalFunctions} from '../../block/Functions.js';
import {DateTime} from 'luxon';
import {getZoneObject, invalidDate} from '../../util/DateTime.js';

export class CreateDateFunction extends PureFunction {
  run() {
    const year = Number(this._data.getValue('year'));
    const month = Number(this._data.getValue('month'));
    const day = Number(this._data.getValue('day'));
    const hour = Number(this._data.getValue('hour')) || 0;
    const minute = Number(this._data.getValue('minute')) || 0;
    const second = Number(this._data.getValue('second')) || 0;
    const millisecond = Number(this._data.getValue('millisecond')) || 0;
    const timezone = this._data.getValue('timezone');
    try {
      this._data.output(
        DateTime.fromObject(
          {year, month, day, hour, minute, second, millisecond},
          getZoneObject(timezone) // convert empty string to undefined
        )
      );
    } catch (err) {
      this._data.output(invalidDate);
    }
  }
}

globalFunctions.add(
  CreateDateFunction,
  {
    name: 'create',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'year', type: 'number', pinned: true},
      {name: 'month', type: 'number', pinned: true},
      {name: 'day', type: 'number', pinned: true},
      {name: 'hour', type: 'number', default: 0, pinned: true},
      {name: 'minute', type: 'number', default: 0, pinned: true},
      {name: 'second', type: 'number', default: 0, unit: 's'},
      {name: 'millisecond', type: 'number', default: 0},
      {name: 'timezone', type: 'string', default: ''},
      {name: '#output', type: 'date', pinned: true, readonly: true},
    ],
  },
  'date'
);
