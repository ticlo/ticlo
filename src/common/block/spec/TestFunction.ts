import {Types} from "../Type";
import {BaseFunction, BlockFunction, FunctionData, PureFunction} from "../BlockFunction";
import {BlockIO, BlockPropertyEvent} from "../BlockProperty";
import {ErrorEvent, Event, EventType, NOT_READY} from "../Event";
import {Dispatcher} from "../Dispatcher";
import {Block} from "../Block";
import {error} from "util";
import {DataMap} from "../../util/Types";


export class TestFunctionRunner extends BaseFunction {

  static logs: any[] = [];

  static popLogs(): any[] {
    let result = TestFunctionRunner.logs;
    TestFunctionRunner.logs = [];
    return result;
  }

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  run(): any {
    TestFunctionRunner.logs.push(this._data.getValue('#-log'));
  }
}

Types.add(TestFunctionRunner, {name: 'test-runner'});

export class TestAsyncFunctionLog {
  static syncLog: any[] = [];
  static asyncLog: any[] = [];

  static clearLog() {
    TestAsyncFunctionLog.syncLog.length = 0;
    TestAsyncFunctionLog.asyncLog.length = 0;
  }

}

// async function that returns Promise
export class TestAsyncFunctionPromise extends PureFunction {
  timeOut: any;
  reject: Function;

  run(): any {
    let promise = new Promise((resolve, reject) => {
      this.reject = reject;
      TestAsyncFunctionLog.syncLog.push(this._data.getValue('#-log'));
      this.timeOut = setTimeout(() => {
        TestAsyncFunctionLog.asyncLog.push(this._data.getValue('#-log'));
        if (this._data.getValue('#-reject')) {
          reject(this._data.getValue('#-reject'));
        } else {
          resolve(this._data.getValue('#-resolve'));
        }
        this.timeOut = null;
      }, 1);
    });
    return promise;
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    if (this.timeOut) {
      clearTimeout(this.timeOut);
      this.timeOut = null;
    }
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

TestAsyncFunctionPromise.prototype.defaultMode = 'onCall';
Types.add(TestAsyncFunctionPromise, {name: 'async-function-promise'});


// async function that manually call block.wait, and return NOT_READY
export class TestAsyncFunctionManual extends BlockFunction {
  timeOut: any;

  run(): any {
    TestAsyncFunctionLog.syncLog.push(this._data.getValue('#-log'));
    this.timeOut = setTimeout(() => {
      TestAsyncFunctionLog.asyncLog.push(this._data.getValue('#-log'));
      if (this._data.getValue('#-reject')) {
        this._data.wait(false, new ErrorEvent('#-reject'));
      } else {
        if (this._data.getValue('#-resolve')) {
          this._data.wait(false, this._data.getValue('#-resolve'));
        } else {
          this._data.wait(false, new Event('complete'));
        }
      }
      this.timeOut = null;
    }, Math.random() * 3);

    this._data.wait(true);
    return NOT_READY;
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    if (this.timeOut) {
      clearTimeout(this.timeOut);
      this.timeOut = null;
    }
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

TestAsyncFunctionManual.prototype.defaultMode = 'onCall';
Types.add(TestAsyncFunctionManual, {name: 'async-function-manual'});

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
  },
  onDone(): void {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onUpdate(response: DataMap): void {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onError(error: string, data?: DataMap): void {
    /* istanbul ignore next */
    throw new Error('should not be called');
  }
};
