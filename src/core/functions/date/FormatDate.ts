import {PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {toDayjs} from '../../util/Dayjs';

export class FormatDateFunction extends PureFunction {
  run() {
    const input = this._data.getValue('input');

    let d = toDayjs(input);
    if (d.isValid()) {
      let format = this._data.getValue('format') as string;
      if (typeof format !== 'string') {
        format = undefined;
      }
      this._data.output(d.format(format));
    } else {
      this._data.output(null);
    }
  }
}

Functions.add(
  FormatDateFunction,
  {
    name: 'format',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'input', type: 'any', pinned: true},
      {name: 'format', type: 'string', pinned: true},
      {name: '#output', type: 'string', pinned: true, readonly: true},
    ],
  },
  'date'
);
