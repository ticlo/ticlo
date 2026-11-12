import {BaseFunction} from '../BlockFunction.ts';
import {ErrorEvent, DoneEvent} from '../Event.ts';
import {Flow, Root} from '../Flow.ts';
import {globalFunctions} from '../FunctionModule.ts';
import {shouldHappen} from '../../util/test-util.ts';

it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])('retains unobserved errors and preserves existing types (async: %s, typed: %s)', async (async, typed) => {
  const failure = typed ? new ErrorEvent('timeout', 'timed out') : new Error('execution failed');
  class FailingFunction extends BaseFunction {
    run() {
      if (async) return Promise.reject(failure);
      throw failure;
    }
  }
  const name = `error-status-${async}`;
  globalFunctions.addFactory(FailingFunction, {name, mode: 'onCall'});
  const flow = new Flow();
  try {
    const block = flow.createBlock('test');
    block.setValue('#is', name);
    expect(block._props.has('#emit')).toBe(false);
    block.emit(undefined);
    expect(block._props.has('#emit')).toBe(false);
    block.updateValue('#call', {});
    Root.run();
    await shouldHappen(() => block._props.get('#emit')?._value instanceof ErrorEvent);
    if (typed) {
      expect(block.getValue('#emit')).toBe(failure);
    } else {
      expect(block.getValue('#emit')).toMatchObject({
        type: async ? ErrorEvent.AsyncError : ErrorEvent.SyncError,
        detail: failure,
      });
    }
    block.emit(undefined);
    expect(block.getValue('#emit')).toBeInstanceOf(DoneEvent);
  } finally {
    flow.destroy();
    globalFunctions.delete(name);
  }
});
