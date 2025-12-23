import {Functions} from '../../block/Functions.js';
import {DateTime} from 'luxon';
import {invalidDate} from '../../util/DateTime.js';
import {AutoUpdateFunction} from '../base/AutoUpdateFunction.js';

const UNIT_OPTIONS = ['year', 'month', 'day', 'hour', 'minute', 'week'] as const;
export type UNIT_TYPE = (typeof UNIT_OPTIONS)[number];

export class GenerateDateFunction extends AutoUpdateFunction {
  run() {
    const count = Number(this._data.getValue('count') ?? 1);
    const unit = (this._data.getValue('unit') as UNIT_TYPE) ?? 'day';
    if (count >= 1 && Number.isInteger(count) && UNIT_OPTIONS.includes(unit)) {
      const isPrevious = this._data.getValue('mode') !== 'next';
      const current = Boolean(this._data.getValue('current'));

      const timezone = this._data.getValue('timezone');
      try {
        let now: DateTime = DateTime.now();
        if (typeof timezone === 'string') {
          now = now.setZone(timezone); // convert empty string to undefined
        }
        const start = now.startOf(unit);
        const end = now.endOf(unit);
        const nextCheck = end.valueOf() + 1;
        let dStart = 0;
        let dEnd = 0;
        if (isPrevious) {
          if (!current) {
            dStart -= 1;
            dEnd -= 1;
          }
          dStart -= count - 1;
        } else {
          if (!current) {
            dStart += 1;
            dEnd += 1;
          }
          dStart += count - 1;
        }
        const result = [start.plus({[unit]: dStart}), start.plus({[unit]: dEnd}).endOf(unit)];
        this._data.output(result);

        this.addSchedule(nextCheck);

        return;
      } catch (err) {
        // output invalid range
      }
    }
    this._data.output([invalidDate, invalidDate]);
  }
}

Functions.add(
  GenerateDateFunction,
  {
    name: 'generate-range',
    icon: 'fas:calendar',
    priority: 0,
    properties: [
      {name: 'mode', type: 'select', options: ['previous', 'next'], init: 'previous', pinned: true},
      {name: 'current', type: 'toggle', default: false, pinned: true},
      {name: 'count', type: 'number', init: 1, pinned: true},
      {name: 'unit', type: 'select', options: UNIT_OPTIONS as any, init: 'day', pinned: true},
      {name: 'timezone', type: 'string', default: ''},
      {name: '#output', type: 'date-range', pinned: true, readonly: true},
    ],
  },
  'date'
);
