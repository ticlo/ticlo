import {globalFunctions} from '../../block/FunctionLib.js';
import {PureFunction} from '../../block/BlockFunction.js';

export class SliceFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    if (typeof input === 'string') {
      const start = this._data.getValue('start');
      const end = this._data.getValue('end');
      this._data.output(input.slice(typeof start === 'number' ? start : 0, typeof end === 'number' ? end : undefined));
    } else {
      this._data.output(undefined);
    }
  }
}

globalFunctions.addFactory(SliceFunction, {
  name: 'slice',
  icon: 'txt:sl',
  properties: [
    {name: 'input', pinned: true, type: 'string'},
    {name: 'start', pinned: true, type: 'number', default: 0},
    {name: 'end', type: 'number'},
    {name: '#output', pinned: true, type: 'string', readonly: true},
  ],
  recipient: '0',
  category: 'string',
});
