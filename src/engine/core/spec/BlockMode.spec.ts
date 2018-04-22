import { assert } from "chai";
import { TestLogicRunner } from "./TestLogic";
import { Job, Root } from "../Job";

describe("BlockMode", () => {
  it('basic block mode', () => {
    let job = new Job();


    let block = job.createBlock('obj');
    block.setValue('#mode', 'manual');
    block.setValue('@log', 'obj');
    block.setValue('#class', 'test-runner');
    block.setValue('input', {});

    Root.run();
    assert.isEmpty(TestLogicRunner.logs,
      'manual mode should not trigger logic');

    block.setValue('#call', {});

    Root.run();
    assert.deepEqual(TestLogicRunner.logs, ['obj'],
      'manual mode should trigger block when called');
    TestLogicRunner.clearLog();

    block.setValue('#mode', 'auto');
    Root.run();
    assert.deepEqual(TestLogicRunner.logs, ['obj'],
      'change mode should trigger logic');
    TestLogicRunner.clearLog();

    block.setValue('input', {});
    Root.run();
    assert.deepEqual(TestLogicRunner.logs, ['obj'],
      'auto mode should trigger block when io property changed');
    TestLogicRunner.clearLog();

    block.setValue('#mode', 'disabled');
    block.setValue('#call', {});
    block.setValue('input', {});
    Root.run();
    assert.isEmpty(TestLogicRunner.logs,
      'disable mode logic should never run');

    block.setValue('#mode', 'sync');
    block.setValue('#call', {});
    assert.deepEqual(TestLogicRunner.logs, ['obj'],
      'sync mode should run logic instantly when called');
    TestLogicRunner.clearLog();

  });
});
