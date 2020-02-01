import {Functions} from '../../../block/Functions';
import {BaseFunction, FunctionData} from '../../../block/BlockFunction';

export class JoinFunction extends BaseFunction {
  run(): any {
    let len = this._data.getLength();
    if (!(len >= 0)) {
      len = 2;
    }
    if (len > 0) {
      let arr: any[] = [];
      for (let i = 0; i < len; ++i) {
        let val = this._data.getValue(String(i));
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
    } else {
      this._data.output(undefined);
    }
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
