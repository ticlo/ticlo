import {Functions} from '../../block/Functions';
import {PureFunction} from '../../block/BlockFunction';

export class JoinFunction extends PureFunction {
  run(): any {
    let arr: any[] = [];
    for (let val of this._data.getArray()) {
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
    this._data.output(arr.join(separator));
  }
}

Functions.add(JoinFunction, {
  name: 'join',
  icon: 'txt:j,o',
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
