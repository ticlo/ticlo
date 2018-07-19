import {Classes} from "../Class";
import {BaseFunction, FunctionData} from "../BlockFunction";
import {BlockIO, BlockPropertyEvent} from "../BlockProperty";
import {NOT_READY} from "../Event";
import {Dispatcher} from "../Dispatcher";
import {Block} from "../Block";


export class TestFunctionRunner extends BaseFunction {

  static logs: any[] = [];

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  run(): any {
    TestFunctionRunner.logs.push(this._data.getValue('@log'));
  }
}

Classes.add('test-runner', TestFunctionRunner);

export class TestAsyncFunctionLog {
  static syncLog: any[] = [];
  static asyncLog: any[] = [];

  static clearLog() {
    TestAsyncFunctionLog.syncLog.length = 0;
    TestAsyncFunctionLog.asyncLog.length = 0;
  }

}

// async function that returns Promise
export class TestAsyncFunctionPromise extends BaseFunction {

  timeOut: any;
  reject: Function;

  run(): any {
    this.cancel();
    let promise = new Promise((resolve, reject) => {
      this.reject = reject;
      TestAsyncFunctionLog.syncLog.push(this._data.getValue('@log'));
      this.timeOut = setTimeout(() => {
        TestAsyncFunctionLog.asyncLog.push(this._data.getValue('@log'));
        resolve();
        this.timeOut = null;
      }, 1);
    });
    this._data.output(promise, '@promise');
    return promise;
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

TestAsyncFunctionPromise.prototype.defaultMode = 'onCall';
Classes.add('async-function-promise', TestAsyncFunctionPromise);


// async function that manually call block.wait, and return NOT_READY
export class TestAsyncFunctionManual extends TestAsyncFunctionPromise {
  run(): any {
    this.cancel();
    let promise = new Promise((resolve, reject) => {
      this.reject = reject;
      TestAsyncFunctionLog.syncLog.push(this._data.getValue('@log'));
      this.timeOut = setTimeout(() => {
        TestAsyncFunctionLog.asyncLog.push(this._data.getValue('@log'));
        resolve();
        this.timeOut = null;
        this._data.wait(false);
      }, 1);
    });
    this._data.output(promise, '@promise');
    this._data.wait(true);
    return NOT_READY;
  }
}

TestAsyncFunctionManual.prototype.defaultMode = 'onCall';
Classes.add('async-function-manual', TestAsyncFunctionManual);

export const VoidListeners = {
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
