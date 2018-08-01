import {assert} from "chai";
import {TestAsyncFunctionLog, shouldReject, shouldTimeout} from "./TestFunction";
import {Job, Root} from "../Job";
import {ErrorEvent, Event} from "../Event";

for (let className of ['async-function-promise', 'async-function-manual']) {

  describe(className, () => {
    beforeEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    afterEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    it('basic', async () => {
      let job = new Job();

      let block = job.createBlock('obj');
      block.setValue('#mode', 'onCall');
      block.setValue('@log', 'obj');
      block.setValue('#is', className);
      block.setValue('#call', {});
      Root.run();

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj'], 'triggered');
      assert.isEmpty(TestAsyncFunctionLog.asyncLog, 'async not finished');
      await block.waitNextValue('#emit');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj'], 'triggered');

      job.setValue('obj', null);
    });

    it('cancel call', async () => {
      let job = new Job();

      let block = job.createBlock('obj');
      block.setValue('#sync', true);
      block.setValue('@log', 'obj');
      block.setValue('#is', className);
      block.setValue('#call', {});

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj'], 'triggered');
      assert.isEmpty(TestAsyncFunctionLog.asyncLog, 'async not finished');

      assert.notEqual(block.getValue('#waiting'), undefined, 'is waiting after called');
      block.setValue('#call', new ErrorEvent('error'));
      assert.isUndefined(block.getValue('#waiting'), 'not waiting after canceled');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, [], 'async call canceled');
    });

    it('chain async call', async () => {
      let job = new Job();

      let block1 = job.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('@log', 'obj1');
      block1.setValue('#is', className);

      let block2 = job.createBlock('obj2');
      block2.setValue('#sync', true);
      block2.setValue('@log', 'obj2');
      block2.setValue('#is', className);
      block2.setBinding('#call', '##.obj1.#emit');

      block1.setValue('#call', {});

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj1'], 'block1 triggered');
      assert.isEmpty(TestAsyncFunctionLog.asyncLog, 'async not finished');
      TestAsyncFunctionLog.clearLog();

      await block1.waitNextValue('#emit');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj1'], 'block1 async finish');
      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj2'], 'block2 triggered');
      TestAsyncFunctionLog.clearLog();

      await block2.waitNextValue('#emit');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj2'], 'block2 run');
      TestAsyncFunctionLog.clearLog();

      block2.updateValue('#call', {});
      assert.notEqual(block2.getValue('#waiting'), undefined, 'is waiting after called');

      let block2EmitPromise = block2.waitNextValue('#emit');
      // #emit need to have binding before next line, otherwise it wont emit
      block1.setValue('#call', new ErrorEvent('error'));
      assert.isUndefined(block2.getValue('#waiting'), 'block1 cancels block2');
      assert.instanceOf(await shouldReject(block2EmitPromise), ErrorEvent, 'block2 should emit error');

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj2'], 'block2 triggered');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, [], 'error from block1 cancels block2');
    });

    it('cancel async call', async () => {
      let job = new Job();

      let block1 = job.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('@log', 'obj1');
      block1.setValue('#is', className);

      let emitPromise = block1.waitNextValue('#emit');
      block1.setValue('#call', {});
      block1.setValue('#cancel', {});
      await shouldTimeout(emitPromise, 20);

    });
  });
}
