import {assert} from 'chai';
import {TestAsyncFunctionPromise, TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';
import {ErrorEvent} from '../Event';

describe('SyncMode', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');
    block.setValue('#sync', true);
    block.setValue('#call', {});
    assert.deepEqual(TestFunctionRunner.logs, ['obj'], 'sync mode should run function instantly when called');
  });

  it('chained', function () {
    let flow = new Flow();

    let block1 = flow.createBlock('obj1');
    block1.setValue('#mode', 'onCall');
    block1.setValue('#-log', 'obj1');
    block1.setValue('#is', 'test-runner');
    block1.setValue('#sync', true);

    let block2 = flow.createBlock('obj2');
    block2.setValue('#mode', 'onLoad');
    block2.setValue('#-log', 'obj2');
    block2.setValue('#is', 'test-runner-immutable');
    block2.setValue('#sync', true);
    block2.setBinding('#call', '##.obj1.#emit');

    let block3 = flow.createBlock('obj3');
    block3.setValue('#mode', 'onCall');
    block3.setValue('#-log', 'obj3');
    block3.setValue('#is', 'test-runner-wont-cancel');
    block3.setValue('#sync', true);
    block3.setBinding('#call', '##.obj2.#emit');

    let block4 = flow.createBlock('obj4');
    block4.setValue('#mode', 'onCall');
    block4.setValue('#-log', 'obj4');
    block4.setValue('#is', 'test-runner');
    block4.setValue('#sync', true);
    block4.setBinding('#call', '##.obj3.#emit');

    block1.setValue('#call', {});
    assert.deepEqual(
      TestFunctionRunner.popLogs(),
      ['obj1', 'obj2', 'obj3', 'obj4'],
      'sync mode should run chained functions instantly when called'
    );

    block1.setValue('#call', {});
    assert.deepEqual(
      TestFunctionRunner.popLogs(),
      ['obj1', 'obj3', 'obj4'],
      "sync call should skip block that doesn't need update"
    );

    block1.setValue('#call', new ErrorEvent(''));
    assert.isEmpty(TestFunctionRunner.logs, 'error should not trigger chained blocks');
    assert.instanceOf(block3.getValue('#call'), ErrorEvent, 'error should get passed through the chain');
    assert.notInstanceOf(
      block4.getValue('#call'),
      ErrorEvent,
      'error should not be passed when function.cancel() return false'
    );
  });
});
