import { Classes } from "../Class";
import { BlockFunction, FunctionData } from "../BlockFunction";


export class TestFunctionRunner extends BlockFunction {

  static logs: any[] = [];

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  constructor(block: FunctionData) {
    super(block);
  }

  call(): any {
    TestFunctionRunner.logs.push(this._data.getValue('@log'));
  }
}

Classes.add('test-runner', TestFunctionRunner);