import {PureFunction} from '../../block/BlockFunction.js';
import {globalFunctions} from '../../block/Functions.js';

export class DefaultValueFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    if (input == null) {
      this._data.output(this._data.getValue('default'));
    } else {
      this._data.output(input);
    }
  }
}

globalFunctions.add(DefaultValueFunction, {
  name: 'default-value',
  icon: 'fas:circle-dot',
  properties: [
    {name: 'input', pinned: true, type: 'any'},
    {name: 'default', pinned: true, type: 'any'},
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  recipient: '0',
  category: 'condition',
});
