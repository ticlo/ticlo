import {Types} from '../../../block/Type';
import {BaseFunction, FunctionData} from '../../../block/BlockFunction';
import {FunctionDesc} from '../../../block/Descriptor';

const descriptorN: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'number', visible: 'high'}]
    },
    {name: 'output', type: 'number', readonly: true}
  ],
  recipient: '0',
  tags: ['math', 'math-n'],
  category: 'math'
};
const descriptor2: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {name: '0', type: 'number', visible: 'high'},
    {name: '1', type: 'number', visible: 'high'},
    {name: 'output', type: 'number', readonly: true}
  ],
  recipient: '0',
  tags: ['math', 'math-2'],
  category: 'math'
};

export class AddFunction extends BaseFunction {
  run(): any {
    let len = this._data.getLength();
    if (!(len >= 0)) {
      len = 2;
    }
    if (len > 0) {
      let sum = 0;
      for (let i = 0; i < len; ++i) {
        let val = this._data.getValue(String(i));
        if (val == null) {
          this._data.output(undefined);
          return;
        }
        sum += Number(val);
      }
      this._data.output(sum);
    } else {
      this._data.output(undefined);
    }
  }
}

Types.add(AddFunction, {
  ...descriptorN,
  name: 'add',
  icon: 'fas:plus',
  order: 0
});

export class MultiplyFunction extends BaseFunction {
  run(): any {
    let len = this._data.getLength();
    if (!(len >= 0)) {
      len = 2;
    }
    if (len > 0) {
      let product = 1;
      for (let i = 0; i < len; ++i) {
        let val = this._data.getValue(String(i));
        if (val == null) {
          this._data.output(undefined);
          return;
        }
        product *= Number(val);
      }
      this._data.output(product);
    } else {
      this._data.output(undefined);
    }
  }
}

Types.add(MultiplyFunction, {
  ...descriptorN,
  name: 'multiply',
  icon: 'fas:times',
  order: 2
});

export class SubtractFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) - Number(v1));
    }
  }
}

Types.add(SubtractFunction, {
  ...descriptor2,
  name: 'subtract',
  icon: 'fas:minus',
  order: 1
});

export class DivideFunction extends BaseFunction {
  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) / Number(v1));
    }
  }
}

Types.add(DivideFunction, {
  ...descriptor2,
  name: 'divide',
  icon: 'fas:divide',
  order: 3
});
