import {PureFunction} from '../../block/BlockFunction.js';
import {globalFunctions} from '../../block/Functions.js';
import {toDateTime} from '../../util/DateTime.js';

export class FormatDateFunction extends PureFunction {
  run() {
    const input = this._data.getValue('input');

    const d = toDateTime(input);
    if (d.isValid) {
      let format = this._data.getValue('format') as string;
      let locale = this._data.getValue('locale') as string;
      if (typeof format !== 'string') {
        format = 'yyyy-LL-dd HH:mm ZZ';
      }
      if (typeof locale !== 'string') {
        locale = undefined;
      }
      try {
        this._data.output(d.toFormat(format, {locale}));
        return;
      } catch (err) {}
    }
    this._data.output(null);
  }
}

globalFunctions.add(
  FormatDateFunction,
  {
    name: 'format',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'input', type: 'any', pinned: true},
      {name: 'format', type: 'string', pinned: true},
      {name: 'locale', type: 'string'},
      {name: '#output', type: 'string', pinned: true, readonly: true},
    ],
  },
  'date'
);
