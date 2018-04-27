import { Classes } from "../../block/Class";
import { BlockFunction, FunctionData } from "../../block/BlockFunction";
import { FunctionDesc } from "../../block/Descriptor";

const descriptorN: FunctionDesc = {
  useLength: true,
  inputs: [
    {group: '', type: 'number'}
  ],
  outputs: [
    {name: 'output', type: 'number'}
  ],
};
const descriptor2: FunctionDesc = {
  inputs: [
    {name: '0', type: 'number'},
    {name: '1', type: 'number'}
  ],
  outputs: [
    {name: 'output', type: 'number'}
  ],
};


export class AddFunction extends BlockFunction {
  constructor(block: FunctionData) {
    super(block);
  }

  call(data: FunctionData): any {
    let len = data.getLength();
    if (!(len >= 0)) {
      len = 2;
    }
    if (len > 0) {
      let sum = 0;
      for (let i = 0; i < len; ++i) {
        let val = data.getValue(String(i));
        if (val == null) {
          data.output(null);
          return;
        }
        sum += Number(val);
      }
      data.output(sum);
    } else {
      data.output(null);
    }
  }
}

AddFunction.prototype.priority = 0;
AddFunction.prototype.descriptor = descriptorN;
Classes.add('add', AddFunction);


export class MultiplyFunction extends BlockFunction {
  constructor(block: FunctionData) {
    super(block);
  }

  call(data: FunctionData): any {
    let len = data.getLength();
    if (!(len >= 0)) {
      len = 2;
    }
    if (len > 0) {
      let product = 1;
      for (let i = 0; i < len; ++i) {
        let val = data.getValue(String(i));
        if (val == null) {
          data.output(null);
          return;
        }
        product *= Number(val);
      }
      data.output(product);
    } else {
      data.output(null);
    }
  }
}

MultiplyFunction.prototype.priority = 0;
MultiplyFunction.prototype.descriptor = descriptorN;
Classes.add('multiply', MultiplyFunction);


export class SubtractFunction extends BlockFunction {
  constructor(block: FunctionData) {
    super(block);
  }

  call(data: FunctionData): any {
    let v0 = data.getValue('0');
    let v1 = data.getValue('1');
    if (v0 == null || v1 == null) {
      data.output(null);
    } else {
      data.output(Number(v0) - Number(v1));
    }
  }
}

SubtractFunction.prototype.priority = 0;
SubtractFunction.prototype.descriptor = descriptor2;
Classes.add('subtract', SubtractFunction);


export class DivideFunction extends BlockFunction {
  constructor(block: FunctionData) {
    super(block);
  }

  call(data: FunctionData): any {
    let v0 = data.getValue('0');
    let v1 = data.getValue('1');
    if (v0 == null || v1 == null) {
      data.output(null);
    } else {
      data.output(Number(v0) / Number(v1));
    }
  }
}

DivideFunction.prototype.priority = 0;
DivideFunction.prototype.descriptor = descriptor2;
Classes.add('divide', DivideFunction);
