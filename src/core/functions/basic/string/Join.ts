import {Functions} from '../../../block/Functions';
import {BaseFunction} from '../../../block/BlockFunction';

export class JoinFunction extends BaseFunction {
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
  icon: 'txt:a,b',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'string', visible: 'high'}]
    },
    {name: 'separator', type: 'string'},
    {name: '#output', type: 'string', readonly: true}
  ],
  recipient: '0',
  category: 'string'
});
