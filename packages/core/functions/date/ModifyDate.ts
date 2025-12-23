import {PureFunction} from '../../block/BlockFunction.js';
import {Functions} from '../../block/Functions.js';
import {DATE_UNITS, invalidDate, toDateTime} from '../../util/DateTime.js';
import {Duration} from 'luxon';

const OPERATIONS = ['add', 'subtract', 'set'];
export class FormatDateFunction extends PureFunction {
  run() {
    const base = this._data.getValue('base');

    let d = toDateTime(base);
    if (d.isValid) {
      const op = this._data.getValue('op') || 'add';
      const count = Number(this._data.getValue('count') ?? 1);
      const unit = (this._data.getValue('unit') as string) ?? 'day';
      if (Number.isInteger(count) && DATE_UNITS.includes(unit)) {
        try {
          switch (op) {
            case 'add':
              this._data.output(d.plus(Duration.fromObject({[`${unit}s`]: count})));
              return;
            case 'subtract':
              this._data.output(d.minus(Duration.fromObject({[`${unit}s`]: count})));
              return;
            case 'set':
              this._data.output(d.set({[unit]: count}));
              return;
          }
        } catch (err) {}
      }
    }
    this._data.output(invalidDate);
  }
}

Functions.add(
  FormatDateFunction,
  {
    name: 'modify',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'base', type: 'any', pinned: true},
      {name: 'op', type: 'select', options: OPERATIONS, init: 'add', pinned: true},
      {name: 'count', type: 'number', init: 1, pinned: true},
      {name: 'unit', type: 'select', options: DATE_UNITS, init: 'day', pinned: true},
      {name: '#output', type: 'string', pinned: true, readonly: true},
    ],
  },
  'date'
);
