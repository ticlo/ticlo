import {Classes} from "../../block/Class";
import {PureFunction, FunctionData} from "../../block/BlockFunction";
import {FunctionDesc} from "../../block/Descriptor";

const descriptorN: FunctionDesc = {
  id: '',
  icon: '',
  useLength: true,
  inputs: [
    {group: '', type: 'number'}
  ],
  outputs: [
    {name: 'output', type: 'number'}
  ],
};
const descriptor2: FunctionDesc = {
  id: '',
  icon: '',
  inputs: [
    {name: '0', type: 'number'},
    {name: '1', type: 'number'}
  ],
  outputs: [
    {name: 'output', type: 'number'}
  ],
};


export class AddFunction extends PureFunction {
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

AddFunction.prototype.priority = 0;
AddFunction.prototype.useLength = true;
Classes.add(AddFunction, {
  ...descriptorN,
  id: 'add',
  icon: 'fas:plus'
});


export class MultiplyFunction extends PureFunction {
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

MultiplyFunction.prototype.priority = 0;
MultiplyFunction.prototype.useLength = true;
Classes.add(MultiplyFunction, {
  ...descriptorN,
  id: 'multiply',
  icon: 'fas:times'
});


export class SubtractFunction extends PureFunction {
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

SubtractFunction.prototype.priority = 0;
Classes.add(SubtractFunction, {
  ...descriptor2,
  id: 'subtract',
  icon: 'fas:minus'
});


export class DivideFunction extends PureFunction {
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

DivideFunction.prototype.priority = 0;
Classes.add(DivideFunction, {
  ...descriptor2,
  id: 'divide',
  icon: 'fas:divide'
});
