import {expect} from 'vitest';
import {TestAsyncFunctionPromise, TestFunctionRunner} from './TestFunction.js';
import {Flow, Root} from '../Flow.js';
import {ErrorEvent} from '../Event.js';

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
    expect(TestFunctionRunner.logs).toEqual(['obj']);
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
    expect(TestFunctionRunner.popLogs()).toEqual(['obj1', 'obj2', 'obj3', 'obj4']);

    block1.setValue('#call', {});
    expect(TestFunctionRunner.popLogs()).toEqual(['obj1', 'obj3', 'obj4']);

    block1.setValue('#call', new ErrorEvent(''));
    expect(TestFunctionRunner.logs).toEqual([]);
    expect(block3.getValue('#call')).toBeInstanceOf(ErrorEvent);
    expect(block4.getValue('#call')).not.toBeInstanceOf(ErrorEvent);
  });
});
