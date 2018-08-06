import {assert} from "chai";
import {TestAsyncFunctionPromise, TestFunctionRunner} from "./TestFunction";
import {Job, Root} from "../Block";
import {Block} from "../Block";
import {ErrorEvent} from "../Event";

describe("SyncMode", () => {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic', () => {

    let job = new Job();

    let block = job.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');
    block.setValue('#sync', true);
    block.setValue('#call', {});
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'sync mode should run function instantly when called');

  });

  it('chained', () => {

    let job = new Job();

    let block1 = job.createBlock('obj1');
    block1.setValue('#mode', 'onCall');
    block1.setValue('#-log', 'obj1');
    block1.setValue('#is', 'test-runner');
    block1.setValue('#sync', true);

    let block2 = job.createBlock('obj2');
    block2.setValue('#mode', 'always');
    block2.setValue('#-log', 'obj2');
    block2.setValue('#is', 'test-runner');
    block2.setValue('#sync', true);
    block2.setBinding('#call', '##.obj1.#emit');

    let block3 = job.createBlock('obj3');
    block3.setValue('#mode', 'onCall');
    block3.setValue('#-log', 'obj3');
    block3.setValue('#is', 'test-runner');
    block3.setValue('#sync', true);
    block3.setBinding('#call', '##.obj2.#emit');

    block1.setValue('#call', {});
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj1', 'obj2', 'obj3'],
      'sync mode should run chained functions instantly when called');

    block1.setValue('#call', {});
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj1', 'obj3'],
      'sync call should skip block that doesn\'t need update');

    block1.setValue('#call', new ErrorEvent(''));
    assert.isEmpty(TestFunctionRunner.logs,
      'error should not trigger chained blocks');
    assert.instanceOf(block3.getValue('#call'), ErrorEvent,
      'error should get passed through the chain');
  });


});
