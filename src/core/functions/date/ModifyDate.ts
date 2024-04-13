import {PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {addDayjs, DATE_UNITS, invalidDay, toDayjs} from '../../util/Dayjs';

const OPERATIONS = ['add', 'subtract', 'set'];
export class FormatDateFunction extends PureFunction {
  run() {
    const base = this._data.getValue('base');

    let d = toDayjs(base);
    if (d.isValid()) {
      const op = this._data.getValue('op');
      let count = Number(this._data.getValue('count'));
      const unit = (this._data.getValue('unit') as any) || 'day';
      if (Number.isFinite(count) && typeof unit === 'string') {
        switch (op) {
          case 'add':
            this._data.output(addDayjs(d, count, unit as any));
            return;
          case 'subtract':
            this._data.output(addDayjs(d, -count, unit as any));
            return;
          case 'set':
            this._data.output(d.set(unit as any, count));
            return;
        }
      }
    }
    this._data.output(invalidDay);
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
      {name: 'op', type: 'select', options: OPERATIONS, pinned: true},
      {name: 'count', type: 'number', pinned: true},
      {name: 'unit', type: 'select', options: DATE_UNITS, pinned: true},
      {name: '#output', type: 'string', pinned: true, readonly: true},
    ],
  },
  'date'
);
