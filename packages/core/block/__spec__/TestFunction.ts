import {Functions} from '../Functions';
import {PureFunction, StatefulFunction} from '../BlockFunction';
import {BlockIO, BlockPropertyEvent} from '../BlockProperty';
import {DoneEvent, ErrorEvent, Event, EventType, WAIT} from '../Event';
import {PropDispatcher} from '../Dispatcher';
import {Block} from '../Block';
import {DataMap} from '../../util/DataTypes';
import {BlockMode} from '../Descriptor';

export class TestFunctionRunner extends PureFunction {
  static logs: unknown[] = [];

  static popLogs(): unknown[] {
    let result = TestFunctionRunner.logs;
    TestFunctionRunner.logs = [];
    return result;
  }

  static clearLog() {
    TestFunctionRunner.logs.length = 0;
  }

  isPure = false;
  run(): unknown {
    TestFunctionRunner.logs.push(this._data.getValue('#-log'));
    return;
  }
}
const TestFunctionApi = {
  commands: {
    test: (block: Block, params: unknown) => {
      block.setValue('#-log', 'command');
    },
  },
};
Functions.add(TestFunctionRunner, {name: 'test-runner'}, null, TestFunctionApi);

class TestFunctionRunnerImmutable extends TestFunctionRunner {
  isPure = true;
}
Functions.add(TestFunctionRunnerImmutable, {name: 'test-runner-immutable'});

class TestFunctionRunnerWontCancel extends TestFunctionRunner {
  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto') {
    return false;
  }
}

Functions.add(TestFunctionRunnerWontCancel, {name: 'test-runner-wont-cancel'});

export class TestAsyncFunctionLog {
  static syncLog: unknown[] = [];
  static asyncLog: unknown[] = [];

  static clearLog() {
    TestAsyncFunctionLog.syncLog.length = 0;
    TestAsyncFunctionLog.asyncLog.length = 0;
  }
}

// async function that returns Promise
export class TestAsyncFunctionPromise extends PureFunction {
  timeOut: NodeJS.Timeout | string | number | undefined;
  reject: Function;

  run(): unknown {
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

  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto') {
    if (this.timeOut) {
      clearTimeout(this.timeOut);
      this.timeOut = null;
    }
    return true;
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

Functions.add(TestAsyncFunctionPromise, {
  name: 'async-function-promise',
  mode: 'onCall',
});

// async function that manually call block.wait, and return NOT_READY
export class TestAsyncFunctionManual extends StatefulFunction {
  timeOut: NodeJS.Timeout | string | number | undefined;

  run(): unknown {
    TestAsyncFunctionLog.syncLog.push(this._data.getValue('#-log'));
    this.timeOut = setTimeout(() => {
      TestAsyncFunctionLog.asyncLog.push(this._data.getValue('#-log'));
      if (this._data.getValue('#-reject')) {
        this._data.emit(new ErrorEvent('#-reject'));
      } else {
        if (this._data.getValue('#-resolve')) {
          this._data.emit(this._data.getValue('#-resolve'));
        } else {
          this._data.emit(new DoneEvent());
        }
      }
      this.timeOut = null;
    }, Math.random() * 10);

    return WAIT;
  }

  cancel(reason: EventType = EventType.TRIGGER, mode: BlockMode = 'auto') {
    if (this.timeOut) {
      clearTimeout(this.timeOut);
      this.timeOut = null;
    }
    return true;
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}

Functions.add(TestAsyncFunctionManual, {
  name: 'async-function-manual',
  priority: 1,
  mode: 'onCall',
});

export const VoidListeners = {
  onSourceChange(prop: PropDispatcher<any>) {
    /* istanbul ignore next */
    throw new Error('should not be called');
  },
  onChange(val: unknown) {
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
  },
};
