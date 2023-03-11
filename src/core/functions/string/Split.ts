import {Functions} from '../../block/Functions';
import {PureFunction} from '../../block/BlockFunction';
import {ErrorEvent} from '../../block/Event';

export class SplitFunction extends PureFunction {
  run(): any {
    let input = this._data.getValue('input');
    if (typeof input === 'string') {
      let separator: string | RegExp = this._data.getValue('separator');
      if (typeof separator !== 'string') {
        separator = ',';
      } else if (this._data.getValue('regExp')) {
        try {
          separator = new RegExp(separator, 'g');
        } catch (e) {
          this._data.output(undefined);
          return new ErrorEvent('invalidRegexp');
        }
      }

      this._data.output(input.split(separator));
    } else {
      this._data.output(undefined);
    }
  }
}

Functions.add(SplitFunction, {
  name: 'split',
  icon: 'txt:s,p',
  properties: [
    {name: 'input', pinned: true, type: 'string'},
    {name: 'separator', type: 'string', placeholder: ','},
    {name: 'regExp', type: 'toggle'},
    {name: '#output', pinned: true, type: 'array', readonly: true},
  ],
  recipient: '0',
  category: 'string',
});
