import {expect} from 'vitest';
import {TestAsyncFunctionLog} from './TestFunction.js';
import {Flow, Root} from '../Flow.js';
import {ErrorEvent, Event} from '../Event.js';
import {shouldReject, shouldTimeout} from '../../util/test-util.js';
import '../../functions/math/Arithmetic.js';

for (const typeName of ['async-function-promise', 'async-function-manual']) {
  describe(typeName, function () {
    beforeEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    afterEach(() => {
      TestAsyncFunctionLog.clearLog();
    });

    it('basic', async function () {
      const flow = new Flow();

      const block = flow.createBlock('obj');
      block.setValue('#mode', 'onCall');
      block.setValue('#-log', 'obj');
      block.setValue('#is', typeName);
      block.setValue('#call', {});
      Root.run();

      expect(TestAsyncFunctionLog.syncLog).toEqual(['obj']);
      expect(TestAsyncFunctionLog.asyncLog).toEqual([]);
      await block.waitNextValue('#emit');
      expect(TestAsyncFunctionLog.asyncLog).toEqual(['obj']);

      flow.setValue('obj', null);
    });

    it('cancel call', async function () {
      const flow = new Flow();

      const block = flow.createBlock('obj');
      block.setValue('#sync', true);
      block.setValue('#-log', 'obj');
      block.setValue('#is', typeName);
      block.setValue('#call', {});

      expect(TestAsyncFunctionLog.syncLog).toEqual(['obj']);
      expect(TestAsyncFunctionLog.asyncLog).toEqual([]);

      expect(block.getValue('#wait')).not.toBe(undefined);
      block.setValue('#call', new ErrorEvent(''));
      expect(block.getValue('#wait')).not.toBeDefined();
      expect(TestAsyncFunctionLog.asyncLog).toEqual([]);
    });

    it('chain async call', async function () {
      const flow = new Flow();

      const block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#is', typeName);

      const block2 = flow.createBlock('obj2');
      block2.setValue('#sync', true);
      block2.setValue('#-log', 'obj2');
      block2.setValue('#is', typeName);
      block2.setBinding('#call', '##.obj1.#emit');

      const block3 = flow.createBlock('obj3');
      block3.setValue('#is', 'add');
      block3.setBinding('#call', '##.obj2.#emit');

      block1.setValue('#call', {});

      expect(TestAsyncFunctionLog.syncLog).toEqual(['obj1']);
      expect(TestAsyncFunctionLog.asyncLog).toEqual([]);
      TestAsyncFunctionLog.clearLog();

      await block1.waitNextValue('#emit');
      expect(TestAsyncFunctionLog.asyncLog).toEqual(['obj1']);
      expect(TestAsyncFunctionLog.syncLog).toEqual(['obj2']);
      TestAsyncFunctionLog.clearLog();

      await block2.waitNextValue('#emit');
      expect(TestAsyncFunctionLog.asyncLog).toEqual(['obj2']);
      TestAsyncFunctionLog.clearLog();

      block2.updateValue('#call', {});
      expect(block2.getValue('#wait')).not.toBe(undefined);
      expect(block3.getValue('#wait')).toBe(undefined);

      const block2EmitPromise = block2.waitNextValue('#emit');
      // #emit need to have binding before next line, otherwise it wont emit
      block1.setValue('#call', new ErrorEvent(''));
      expect(block2.getValue('#wait')).not.toBeDefined();
      expect(block3.getValue('#wait')).not.toBeDefined();
      expect(await shouldReject(block2EmitPromise)).toBeInstanceOf(ErrorEvent);

      expect(TestAsyncFunctionLog.syncLog).toEqual(['obj2']);
      expect(TestAsyncFunctionLog.asyncLog).toEqual([]);
    });

    it('cancel async call', async function () {
      const flow = new Flow();

      const block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#is', typeName);

      block1.setValue('#cancel', 1);
      block1.setValue('#call', {});
      await block1.waitNextValue('#emit');
      expect(TestAsyncFunctionLog.asyncLog).toEqual(['obj1']);

      const emitPromise = block1.waitNextValue('#emit');
      block1.setValue('#call', {});
      block1.setValue('#cancel', 2);
      await shouldTimeout(emitPromise, 20);
    });

    it('reject async call', async function () {
      const flow = new Flow();

      const block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#-reject', true);
      block1.setValue('#is', typeName);

      block1.setValue('#call', {});
      await shouldReject(block1.waitValue('#emit'));
    });

    it('async emit custom value', async function () {
      const flow = new Flow();

      const block1 = flow.createBlock('obj1');
      block1.setValue('#sync', true);
      block1.setValue('#-log', 'obj1');
      block1.setValue('#-resolve', 'ticlo');
      block1.setValue('#is', typeName);

      block1.setValue('#call', {});
      expect(await block1.waitValue('#emit')).toBe('ticlo');
    });
  });
}
