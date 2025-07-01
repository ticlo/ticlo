import {expect} from 'vitest';
import {TestAsyncFunctionLog, TestAsyncFunctionPromise, TestFunctionRunner} from './TestFunction';
import {Block} from '../Block';
import {Flow, Root} from '../Flow';

describe('BlockMode', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic block mode', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');
    block.setValue('input', {});

    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    block.setValue('#call', {});

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('#mode', 'onChange');
    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    block.setValue('#mode', 'onLoad');
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('input', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);
  });

  it('block mode on load', function () {
    let flow = new Flow();

    let b0 = flow.createBlock('onLoad');
    b0.setValue('#mode', 'onLoad');
    let b1 = flow.createBlock('onChange');
    b1.setValue('#mode', 'onChange');
    let b2 = flow.createBlock('onCall');
    b2.setValue('#mode', 'onCall');
    let b3 = flow.createBlock('sync');
    b3.setValue('#mode', 'onCall');
    b3.setValue('#sync', true);
    let b4 = flow.createBlock('disabled');
    b4.setValue('#disabled', true);

    b0.setValue('#-log', 'b0');
    b0.setValue('#is', 'test-runner');
    b0.setValue('input', {});
    b1.setValue('#-log', 'b1');
    b1.setValue('#is', 'test-runner');
    b1.setValue('input', {});
    b2.setValue('#-log', 'b2');
    b2.setValue('#is', 'test-runner');
    b2.setValue('input', {});
    b3.setValue('#-log', 'b3');
    b3.setValue('#is', 'test-runner');
    b3.setValue('input', {});
    b4.setValue('#-log', 'b4');
    b4.setValue('#is', 'test-runner');
    b4.setValue('input', {});

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['b0', 'b1']);

    let saved = flow.save();
    let flow2 = new Flow();
    flow2.load(saved);

    Root.run();
    expect(TestFunctionRunner.logs).toEqual(['b0']);
  });

  it('block mode on liveUpdate', function () {
    let flow = new Flow();

    let b0 = flow.createBlock('b0');
    b0.setValue('#mode', 'onLoad');
    let b1 = flow.createBlock('b1');
    b1.setValue('#mode', 'onChange');

    b0.setValue('#-log', 'b0');
    b0.setValue('#is', 'test-runner');
    b0.setValue('input', 1);
    b1.setValue('#-log', 'b1');
    b1.setValue('#is', 'test-runner');
    b1.setBinding('input', '##.b0.input');
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['b0', 'b1']);

    let save1 = flow.save();

    let b2 = flow.createBlock('b2');
    b2.setValue('#mode', 'onLoad');
    let b3 = flow.createBlock('b3');
    b3.setValue('#mode', 'onChange');

    b0.setValue('input', 2);
    b1.setValue('input', 2);
    b2.setValue('#-log', 'b2');
    b2.setValue('#is', 'test-runner');
    b2.setValue('input', 2);
    b3.setValue('#-log', 'b3');
    b3.setValue('#is', 'test-runner');
    b3.setValue('input', 2);

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['b0', 'b1', 'b2', 'b3']);
    let save2 = flow.save();

    flow.liveUpdate(save1);
    Root.run();
    expect(TestFunctionRunner.logs).toEqual(['b0']);
    let save1New = flow.save();
    expect(save1).toEqual(save1New);
    TestFunctionRunner.clearLog();

    flow.liveUpdate(save2);
    Root.run();
    expect(TestFunctionRunner.logs).toEqual(['b0', 'b2']);
  });

  it('binding route change', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');
    block.setBinding('#call', '#');
    expect(block.getValue('#call')).toBe(block);
    Root.run();
    TestFunctionRunner.clearLog();

    let blockA = block.createBlock('a');
    blockA.setBinding('@parent', '##');
    block.setBinding('@child', 'a');
    block.setBinding('#call', '@child.@parent');
    Root.run();
    expect(block.getValue('#call')).toBe(block);
    expect(TestFunctionRunner.logs).toEqual([]);

    let blockB = block.createBlock('b');
    blockB.setBinding('@parent', '##');
    block.setBinding('@child', 'b');
    Root.run();
    expect(block.getValue('#call')).toBe(block);
    expect(TestFunctionRunner.logs).toEqual([]);

    block.updateValue('@child', {'@parent': block});
    Root.run();
    expect(block.getValue('#call')).toBe(block);
    expect(TestFunctionRunner.logs).toEqual([]);
  });
});
