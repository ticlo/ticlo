import {PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {createDayjs} from '../../util/Dayjs';

export class CreateDateFunction extends PureFunction {
  run() {
    const year = Number(this._data.getValue('year'));
    const month = Number(this._data.getValue('month'));
    const date = Number(this._data.getValue('date'));
    const hour = Number(this._data.getValue('hour'));
    const minute = Number(this._data.getValue('minute'));
    const second = Number(this._data.getValue('second'));
    const millisecond = Number(this._data.getValue('millisecond'));
    const timezone = this._data.getValue('timezone');
    this._data.output(createDayjs(year, month, date, hour, minute, second, millisecond, timezone));
  }
}

Functions.add(
  CreateDateFunction,
  {
    name: 'create',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'year', type: 'number', pinned: true},
      {name: 'month', type: 'number', pinned: true},
      {name: 'date', type: 'number', pinned: true},
      {name: 'hour', type: 'number', pinned: true},
      {name: 'minute', type: 'number', pinned: true},
      {name: 'second', type: 'number'},
      {name: 'millisecond', type: 'number'},
      {name: 'timezone', type: 'any', types: ['string', 'number']},
      {name: '#output', type: 'date', pinned: true, readonly: true},
    ],
  },
  'date'
);
