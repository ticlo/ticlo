import {globalFunctions} from '../../block/FunctionLib.ts';
import {PureFunction} from '../../block/BlockFunction.ts';
import {getInputsArray} from '../../block/FunctonData.ts';

export class JoinFunction extends PureFunction {
  // REFACTOR(design.md): MUST read event inputs for this delivery; MUST retain prior values only as declared state.
  run(): any {
    let arr: any[] = [];
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      } else if (Array.isArray(val)) {
        arr = arr.concat(val);
      } else {
        arr.push(val);
      }
    }
    let separator = this._data.getValue('separator');
    if (typeof separator !== 'string') {
      separator = '';
    }
    this._data.output(arr.join(separator as string));
  }
}

globalFunctions.addFactory(JoinFunction, {
  name: 'join',
  icon: '15^:j,o',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'string', pinned: true}],
    },
    {name: 'separator', type: 'string'},
    {name: '#output', pinned: true, type: 'string', readonly: true},
  ],
  recipient: '0',
  category: 'string',
});
