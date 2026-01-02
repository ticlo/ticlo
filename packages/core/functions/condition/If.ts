import {PureFunction} from '../../block/BlockFunction.js';
import {globalFunctions} from '../../block/Functions.js';

export class IfFunction extends PureFunction {
  run(): any {
    const input = this._data.getValue('input');
    if (input) {
      this._data.output(this._data.getValue('then'));
    } else {
      this._data.output(this._data.getValue('else'));
    }
  }
}

globalFunctions.add(IfFunction, {
  name: 'if',
  icon: 'txt:if',
  properties: [
    {name: 'input', pinned: true, type: 'any'},
    {name: 'then', pinned: true, type: 'any'},
    {name: 'else', pinned: true, type: 'any'},
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  recipient: '0',
  category: 'condition',
});
