import {BaseLogic2} from "./BaseLogic2";
import {Types} from "../../core/Type";
import {Block} from "../../core/Block";

export class Add2 extends BaseLogic2 {
  constructor(block: Block) {
    super(block);
  }

  run(val: any): any {
    let v0 = this._input0._value;
    let v1 = this._input1._value;
    if (v0 == null || v1 == null) {
      this._out.updateValue(null);
    } else {
      this._out.updateValue(Number(v0) + Number(v1));
    }
  };
}

Types.add('+', Add2);
