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

  run(data: FunctionData): any {
    TestFunctionRunner.logs.push(data.getValue('@log'));
  }
}

Classes.add('test-runner', TestFunctionRunner);
