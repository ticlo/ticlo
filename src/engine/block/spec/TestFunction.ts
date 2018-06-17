import { Classes } from "../Class";
import { BlockFunction, FunctionData } from "../BlockFunction";
import { Block$Property } from "../BlockProperty";
import { NOT_READY } from "../Event";


export class TestFunctionRunner extends BlockFunction {

  static logs: any[] = [];

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  run(data: FunctionData): any {
    TestFunctionRunner.logs.push(data.getValue('@log'));
  }

  input$Changed(input: Block$Property, val: any): boolean {
    return (input._name === '$run');
  }
}

Classes.add('test-runner', TestFunctionRunner);


export class TestAsyncFunction extends BlockFunction {

  static syncLog: any[] = [];
  static asyncLog: any[] = [];

  static clearLog() {
    TestAsyncFunction.syncLog.length = 0;
    TestAsyncFunction.asyncLog.length = 0;
  }

  run(data: FunctionData): any {
    let promise = new Promise((resolve, reject) => {
      TestAsyncFunction.syncLog.push(data.getValue('@log'));
      setTimeout(() => {
        TestAsyncFunction.asyncLog.push(data.getValue('@log'));
        data.asyncEmit();
        resolve();
      }, 1);
    });
    data.updateValue('@promise', promise);
    return NOT_READY;
  }
}

Classes.add('async-function', TestAsyncFunction);