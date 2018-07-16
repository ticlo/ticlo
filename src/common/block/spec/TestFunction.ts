import {Classes} from "../Class";
import {BlockFunction, FunctionData} from "../BlockFunction";
import {BlockIO, BlockPropertyEvent} from "../BlockProperty";
import {NOT_READY} from "../Event";
import {Dispatcher} from "../Dispatcher";
import {Block} from "../Block";


export class TestFunctionRunner extends BlockFunction {

  static logs: any[] = [];

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  run(data: FunctionData): any {
    TestFunctionRunner.logs.push(data.getValue('@log'));
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

  timeOut: any;
  reject: Function;

  run(data: FunctionData): any {
    this.cancel();
    let promise = new Promise((resolve, reject) => {
      this.reject = reject;
      TestAsyncFunction.syncLog.push(data.getValue('@log'));
      this.timeOut = setTimeout(() => {
        TestAsyncFunction.asyncLog.push(data.getValue('@log'));
        data.wait(undefined);
        resolve();
        this.timeOut = null;
      }, 1);
    });
    data.output(promise, '@promise');
    data.wait(true);
  }

  cancel() {
    if (this.timeOut) {
      clearTimeout(this.timeOut);
      this.timeOut = null;
      this.reject(new Error());
    }
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}


export const voidListeners = {
  onSourceChange(prop: Dispatcher<any>) {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onChange(val: any) {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onPropertyEvent(change: BlockPropertyEvent) {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onChildChange(property: BlockIO, saved?: boolean) {
    /* istanbul ignore next */
    throw new Error('should not be called');
  }
};

TestAsyncFunction.prototype.defaultMode = 'onCall';

Classes.add('async-function', TestAsyncFunction);