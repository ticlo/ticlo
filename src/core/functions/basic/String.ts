import {Types} from "../../block/Type";
import {PureFunction, FunctionData} from "../../block/BlockFunction";
import {FunctionDesc} from "../../block/Descriptor";

export class JoinFunction extends PureFunction {
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

JoinFunction.prototype.priority = 0;
JoinFunction.prototype.useLength = true;
Types.add(JoinFunction, {
  name: 'join',
  icon: 'txt:a,b',
  useLength: true,
  properties: [
    {name: '', type: 'group', defaultLen: 2, properties: [{name: '', type: 'string', visible: 'high'}]},
    {name: 'separator', type: 'string'},
    {name: 'output', type: 'string', readonly: true}
  ],
  recipient: '0',
  category: 'string',
});
