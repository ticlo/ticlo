import { Classes } from "../Class";
import { BlockFunction, FunctionData } from "../BlockFunction";
import { Block$Property } from "../BlockProperty";


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

  input$Changed(input: Block$Property, val: any): boolean {
    return (input._name === '$run');
  }
}

Classes.add('test-runner', TestFunctionRunner);
