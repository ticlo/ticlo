import {PureFunction} from "../../../block/BlockFunction";
import {Types} from "../../../block/Type";
import {FunctionDesc} from "../../../block/Descriptor";

const descriptor: FunctionDesc = {
  name: '',
  icon: '',
  recipient: '0',
  category: 'string',
  properties: [
    {name: '0', type: 'string', visible: 'high'},
    {name: '1', type: 'string', visible: 'high'},
    {name: 'output', type: 'toggle', readonly: true}
  ]
};

export class StartWithFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (typeof v0 !== 'string' || typeof v1 !== 'string') {
      this._data.output(undefined);
    } else {
      this._data.output(v0.startsWith(v1));
    }
  }
}

Types.add(StartWithFunction, {
  ...descriptor,
  name: 'start-with',
  icon: 'txt:a~'
});

export class EndWithFunction extends PureFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (typeof v0 !== 'string' || typeof v1 !== 'string') {
      this._data.output(undefined);
    } else {
      this._data.output(v0.endsWith(v1));
    }
  }
}

Types.add(EndWithFunction, {
  ...descriptor,
  name: 'end-with',
  icon: 'txt:~a'
});