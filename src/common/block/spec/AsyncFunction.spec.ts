import {assert} from "chai";
import {TestAsyncFunctionLog} from "./TestFunction";
import {Job, Root} from "../Job";
import {ErrorEvent} from "../Event";

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
      await block.getValue('@promise');
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

      block.setValue('#call', new ErrorEvent('error'));

      try {
        await block.getValue('@promise');
        /* istanbul ignore next */
        assert(false, 'promise should be rejected');
      } catch (err) {
        // ignore
      }
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

      await block1.getValue('@promise');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj1'], 'block1 async finish');
      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj2'], 'block2 triggered');
      TestAsyncFunctionLog.clearLog();

      await block2.getValue('@promise');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj2'], 'block2 run');
      TestAsyncFunctionLog.clearLog();

      block2.updateValue('#call', {});
      // call with error later, when Promise is being awaited
      block1.setValue('#call', new ErrorEvent('error'));
      try {
        await block1.getValue('@promise');
        /* istanbul ignore next */
        assert(false, 'promise should be rejected');
      } catch (err) {
        // ignore
      }
      try {
        await block2.getValue('@promise');
        /* istanbul ignore next */
        assert(false, 'promise should be rejected');
      } catch (err) {
        // ignore
      }
      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj2'], 'block2 triggered');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, [], 'error from block1 cancels block2');
    });
  });


}
