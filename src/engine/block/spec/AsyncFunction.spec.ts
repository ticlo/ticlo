import { assert } from "chai";
import { TestAsyncFunction } from "./TestFunction";
import { Job, Root } from "../Job";
import { ErrorEvent } from "../Event";

describe("AsyncFunction", () => {
  beforeEach(() => {
    TestAsyncFunction.clearLog();
  });

  afterEach(() => {
    TestAsyncFunction.clearLog();
  });

  it('basic', async () => {
    let job = new Job();

    let block = job.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('@log', 'obj');
    block.setValue('#is', 'async-function');
    block.setValue('#call', {});
    Root.run();

    assert.deepEqual(TestAsyncFunction.syncLog, ['obj'], 'triggered');
    assert.isEmpty(TestAsyncFunction.asyncLog, 'async not finished');
    await block.getValue('@promise');
    assert.deepEqual(TestAsyncFunction.asyncLog, ['obj'], 'triggered');

    block.setValue('obj', null);
  });

  it('cancel call', async () => {
    let job = new Job();

    let block = job.createBlock('obj');
    block.setValue('#sync', true);
    block.setValue('@log', 'obj');
    block.setValue('#is', 'async-function');
    block.setValue('#call', {});

    assert.deepEqual(TestAsyncFunction.syncLog, ['obj'], 'triggered');
    assert.isEmpty(TestAsyncFunction.asyncLog, 'async not finished');

    block.setValue('#call', new ErrorEvent('error'));

    try {
      await block.getValue('@promise');
      /* istanbul ignore next */
      assert(false, 'promise should be rejected');
    } catch (err) {
      // ignore
    }
    assert.deepEqual(TestAsyncFunction.asyncLog, [], 'async call canceled');
  });

  it('chain async call', async () => {
    let job = new Job();

    let block1 = job.createBlock('obj1');
    block1.setValue('#sync', true);
    block1.setValue('@log', 'obj1');
    block1.setValue('#is', 'async-function');

    let block2 = job.createBlock('obj2');
    block2.setValue('#sync', true);
    block2.setValue('@log', 'obj2');
    block2.setValue('#is', 'async-function');
    block2.setBinding('#call', '##.obj1.#emit');

    block1.setValue('#call', {});

    assert.deepEqual(TestAsyncFunction.syncLog, ['obj1'], 'block1 triggered');
    assert.isEmpty(TestAsyncFunction.asyncLog, 'async not finished');
    TestAsyncFunction.clearLog();

    await block1.getValue('@promise');
    assert.deepEqual(TestAsyncFunction.asyncLog, ['obj1'], 'block1 async finish');
    assert.deepEqual(TestAsyncFunction.syncLog, ['obj2'], 'block2 triggered');
    TestAsyncFunction.clearLog();

    await block2.getValue('@promise');
    assert.deepEqual(TestAsyncFunction.asyncLog, ['obj2'], 'block2 run');
    TestAsyncFunction.clearLog();

    block2.updateValue('#call', {});
    // call with error later, when Promise is being awaited
    setTimeout(() => block1.setValue('#call', new ErrorEvent('error')), 0);
    try {
      await block1.getValue('@promise');
      /* istanbul ignore next */
      assert(false, 'promise should be rejected');
    } catch (err) {
      // ignore
    }
    assert.deepEqual(TestAsyncFunction.syncLog, ['obj2'], 'block2 triggered');
    assert.deepEqual(TestAsyncFunction.asyncLog, [], 'error from block1 cancels block2');
  });
});
