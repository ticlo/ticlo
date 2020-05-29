import {assert} from 'chai';
import {TestAsyncFunctionLog} from './TestFunction';
import {Flow, Root} from '../Flow';
import {ErrorEvent, Event} from '../Event';
import {shouldReject, shouldTimeout} from '../../util/test-util';
import '../../functions/math/Arithmetic';

for (let typeName of ['async-function-promise', 'async-function-manual']) {
  describe(typeName, function () {
    beforeEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    afterEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    it('basic', async function () {
      let flow = new Flow();

      let block = flow.createBlock('obj');
      block.setValue('#mode', 'onCall');
      block.setValue('#-log', 'obj');
      block.setValue('#is', typeName);
      block.setValue('#call', {});
      Root.run();

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj'], 'triggered');
      assert.isEmpty(TestAsyncFunctionLog.asyncLog, 'async not finished');
      await block.waitNextValue('#emit');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj'], 'triggered');

      flow.setValue('obj', null);
    });

    it('cancel call', async function () {
      let flow = new Flow();

      let block = flow.createBlock('obj');
      block.setValue('#sync', true);
      block.setValue('#-log', 'obj');
      block.setValue('#is', typeName);
      block.setValue('#call', {});

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj'], 'triggered');
      assert.isEmpty(TestAsyncFunctionLog.asyncLog, 'async not finished');

      assert.notEqual(block.getValue('#wait'), undefined, 'is waiting after called');
      block.setValue('#call', new ErrorEvent(''));
      assert.isUndefined(block.getValue('#wait'), 'not waiting after canceled');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, [], 'async call canceled');
    });

    it('chain async call', async function () {
      let flow = new Flow();

      let block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#is', typeName);

      let block2 = flow.createBlock('obj2');
      block2.setValue('#sync', true);
      block2.setValue('#-log', 'obj2');
      block2.setValue('#is', typeName);
      block2.setBinding('#call', '##.obj1.#emit');

      let block3 = flow.createBlock('obj3');
      block3.setValue('#is', 'add');
      block3.setBinding('#call', '##.obj2.#emit');

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
      assert.notEqual(block2.getValue('#wait'), undefined, 'is waiting after called');
      assert.equal(block3.getValue('#wait'), undefined, '#wait of next block is not affected');

      let block2EmitPromise = block2.waitNextValue('#emit');
      // #emit need to have binding before next line, otherwise it wont emit
      block1.setValue('#call', new ErrorEvent(''));
      assert.isUndefined(block2.getValue('#wait'), 'block1 cancels block2');
      assert.isUndefined(block3.getValue('#wait'), '#wait is chained');
      assert.instanceOf(await shouldReject(block2EmitPromise), ErrorEvent, 'block2 should emit error');

      assert.deepEqual(TestAsyncFunctionLog.syncLog, ['obj2'], 'block2 triggered');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, [], 'error from block1 cancels block2');
    });

    it('cancel async call', async function () {
      let flow = new Flow();

      let block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#is', typeName);

      block1.setValue('#cancel', 1);
      block1.setValue('#call', {});
      await block1.waitNextValue('#emit');
      assert.deepEqual(TestAsyncFunctionLog.asyncLog, ['obj1'], 'cancel should not affect next run');

      let emitPromise = block1.waitNextValue('#emit');
      block1.setValue('#call', {});
      block1.setValue('#cancel', 2);
      await shouldTimeout(emitPromise, 20);
    });

    it('reject async call', async function () {
      let flow = new Flow();

      let block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#-reject', true);
      block1.setValue('#is', typeName);

      block1.setValue('#call', {});
      await shouldReject(block1.waitValue('#emit'));
    });

    it('async emit custom value', async function () {
      let flow = new Flow();

      let block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#-resolve', 'ticlo');
      block1.setValue('#is', typeName);

      block1.setValue('#call', {});
      assert.equal(await block1.waitValue('#emit'), 'ticlo');
    });
  });
}
