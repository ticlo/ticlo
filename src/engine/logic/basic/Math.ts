import { Classes } from "../../core/Class";
import { Logic, LogicData } from "../../core/Logic";
import { LogicDesc } from "../../core/Descriptor";

const descriptorN: LogicDesc = {
  useLength: true,
  inputs: [
    { group: '', type: 'number' }
  ],
  outputs: [
    { name: 'output', type: 'number' }
  ],
};
const descriptor2: LogicDesc = {
  inputs: [
    { name: '0', type: 'number' },
    { name: '1', type: 'number' }
  ],
  outputs: [
    { name: 'output', type: 'number' }
  ],
};


export class AddLogic extends Logic {
  constructor(block: LogicData) {
    super(block);
  }

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
          this._data.output(null);
          return;
        }
        sum += Number(val);
      }
      this._data.output(sum);
    } else {
      this._data.output(null);
    }
  }
}

AddLogic.prototype.priority = 0;
AddLogic.prototype.descriptor = descriptorN;
Classes.add('add', AddLogic);


export class MultiplyLogic extends Logic {
  constructor(block: LogicData) {
    super(block);
  }

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
          this._data.output(null);
          return;
        }
        product *= Number(val);
      }
      this._data.output(product);
    } else {
      this._data.output(null);
    }
  }
}

MultiplyLogic.prototype.priority = 0;
MultiplyLogic.prototype.descriptor = descriptorN;
Classes.add('multiply', MultiplyLogic);


export class SubtractLogic extends Logic {
  constructor(block: LogicData) {
    super(block);
  }

  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(null);
    } else {
      this._data.output(Number(v0) - Number(v1));
    }
  }
}

SubtractLogic.prototype.priority = 0;
SubtractLogic.prototype.descriptor = descriptor2;
Classes.add('subtract', SubtractLogic);


export class DivideLogic extends Logic {
  constructor(block: LogicData) {
    super(block);
  }

  run(): any {
    let v0 = this._data.getValue('0');
    let v1 = this._data.getValue('1');
    if (v0 == null || v1 == null) {
      this._data.output(null);
    } else {
      this._data.output(Number(v0) / Number(v1));
    }
  }
}

DivideLogic.prototype.priority = 0;
DivideLogic.prototype.descriptor = descriptor2;
Classes.add('divide', DivideLogic);
