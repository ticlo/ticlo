import { assert } from "chai";
import { TestFunctionRunner } from "./TestFunction";
import { Job, Root } from "../Job";

describe("BlockMode", () => {
  it('basic block mode', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

    let block = job.createBlock('obj');
    block.setValue('#mode', 'manual');
    block.setValue('@log', 'obj');
    block.setValue('#class', 'test-runner');
    block.setValue('input', {});

    Root.run();
    assert.isEmpty(TestFunctionRunner.logs,
      'manual mode should not trigger function');

    block.setValue('#call', {});

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'manual mode should trigger block when called');
    TestFunctionRunner.clearLog();

    block.setValue('#mode', 'auto');
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['obj'],
      'change mode should trigger function');
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
});
