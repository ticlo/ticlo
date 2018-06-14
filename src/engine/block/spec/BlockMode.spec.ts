import { assert } from "chai";
import { TestFunctionRunner } from "./TestFunction";
import { Job, Root } from "../Job";
import { Block } from "../Block";

describe("BlockMode", () => {
  it('basic block mode', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

    let block = job.createBlock('obj');
    block.setValue('#mode', 'onCall');
    block.setValue('@log', 'obj');
    block.setValue('#is', 'test-runner');
    block.setValue('input', {});

    Root.run();
    assert.isEmpty(TestFunctionRunner.logs,
      'manual mode should not trigger function');

    block.setValue('#call', {});

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'manual mode should trigger block when called');
    TestFunctionRunner.clearLog();

    block.setValue('#mode', 'onChange');
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, [],
      'change mode to onChange should not trigger function');

    block.setValue('#mode', 'always');
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'change mode to always should trigger function');
    TestFunctionRunner.clearLog();

    block.setValue('input', {});
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'auto mode should trigger block when io property changed');
    TestFunctionRunner.clearLog();

    block.setValue('#mode', 'disabled');
    block.setValue('#call', {});
    block.setValue('input', {});
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs,
      'disable mode function should never run');

    block.setValue('#mode', 'sync');
    block.setValue('#call', {});
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'sync mode should run function instantly when called');
    TestFunctionRunner.clearLog();

  });

  it('block mode on load', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

    let b0 = job.createBlock('always');
    b0.setValue('#mode', 'always');
    let b1 = job.createBlock('onChange');
    b1.setValue('#mode', 'onChange');
    let b2 = job.createBlock('onCall');
    b2.setValue('#mode', 'onCall');
    let b3 = job.createBlock('sync');
    b3.setValue('#mode', 'sync');
    let b4 = job.createBlock('disabled');
    b4.setValue('#mode', 'disabled');

    b0.setValue('@log', 'b0');
    b0.setValue('#is', 'test-runner');
    b0.setValue('input', {});
    b1.setValue('@log', 'b1');
    b1.setValue('#is', 'test-runner');
    b1.setValue('input', {});
    b2.setValue('@log', 'b2');
    b2.setValue('#is', 'test-runner');
    b2.setValue('input', {});
    b3.setValue('@log', 'b3');
    b3.setValue('#is', 'test-runner');
    b3.setValue('input', {});
    b4.setValue('@log', 'b4');
    b4.setValue('#is', 'test-runner');
    b4.setValue('input', {});

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0', 'b1'],
      'mode always and onChange should be called');
    TestFunctionRunner.clearLog();

    let saved = job._save();
    let job2 = new Job();
    job2.load(saved);

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0'],
      'mode always should be called after load');
    TestFunctionRunner.clearLog();
  });

  it('block mode on liveUpdate', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

    let b0 = job.createBlock('b0');
    b0.setValue('#mode', 'always');
    let b1 = job.createBlock('b1');
    b1.setValue('#mode', 'onChange');

    b0.setValue('@log', 'b0');
    b0.setValue('#is', 'test-runner');
    b0.setValue('input', 1);
    b1.setValue('@log', 'b1');
    b1.setValue('#is', 'test-runner');
    b1.setBinding('input', '##.b0.input');
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0', 'b1'],
      'first snapshot');
    TestFunctionRunner.clearLog();

    let save1 = job.save();

    let b2 = job.createBlock('b2');
    b2.setValue('#mode', 'always');
    let b3 = job.createBlock('b3');
    b3.setValue('#mode', 'onChange');

    b0.setValue('input', 2);
    b1.setValue('input', 2);
    b2.setValue('@log', 'b2');
    b2.setValue('#is', 'test-runner');
    b2.setValue('input', 2);
    b3.setValue('@log', 'b3');
    b3.setValue('#is', 'test-runner');
    b3.setValue('input', 2);

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0', 'b1', 'b2', 'b3'],
      'second snapshot');
    TestFunctionRunner.clearLog();
    let save2 = job.save();

    job.liveUpdate(save1);
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0'],
      'undo to first snapshot');
    let save1New = job.save();
    assert.deepEqual(save1, save1New, 'saved data should be same after live update');
    TestFunctionRunner.clearLog();

    job.liveUpdate(save2);
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['b0', 'b2'],
      'redo to second snapshot');
    TestFunctionRunner.clearLog();
  });
});
