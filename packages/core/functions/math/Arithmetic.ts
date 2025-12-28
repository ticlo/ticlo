import {Functions} from '../../block/Functions.js';
import {PureFunction} from '../../block/BlockFunction.js';
import {FunctionDesc} from '../../block/Descriptor.js';
import {getInputsArray} from '../../block/FunctonData.js';

const descriptorN: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 2,
      properties: [{name: '', type: 'number', pinned: true}],
    },
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: '0',
  tags: ['math', 'math-n'],
  category: 'math',
};
const descriptor2: FunctionDesc = {
  name: '',
  icon: '',
  properties: [
    {name: '0', type: 'number', pinned: true},
    {name: '1', type: 'number', pinned: true},
    {name: '#output', pinned: true, type: 'number', readonly: true},
  ],
  recipient: '0',
  tags: ['math', 'math-2'],
  category: 'math',
};

export class AddFunction extends PureFunction {
  run(): any {
    let sum = 0;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      sum += Number(val);
    }
    this._data.output(sum);
  }
}

Functions.add(AddFunction, {
  ...descriptorN,
  name: 'add',
  icon: 'fas:plus',
});

export class MultiplyFunction extends PureFunction {
  run(): any {
    let product = 1;
    for (const val of getInputsArray(this._data)) {
      if (val == null) {
        this._data.output(undefined);
        return;
      }
      product *= Number(val);
    }
    this._data.output(product);
  }
}

Functions.add(MultiplyFunction, {
  ...descriptorN,
  name: 'multiply',
  icon: 'fas:xmark',
});

export class SubtractFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) - Number(v1));
    }
  }
}

Functions.add(SubtractFunction, {
  ...descriptor2,
  name: 'subtract',
  icon: 'fas:minus',
});

export class DivideFunction extends PureFunction {
  run(): any {
    const v0 = this._data.getValue('0');
    const v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(undefined);
    } else {
      this._data.output(Number(v0) / Number(v1));
    }
  }
}

Functions.add(DivideFunction, {
  ...descriptor2,
  name: 'divide',
  icon: 'fas:divide',
});
