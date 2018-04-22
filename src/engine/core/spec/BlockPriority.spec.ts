import { assert } from "chai";
import { TestLogicRunner } from "./TestLogic";
import { Job, Root } from "../Job";

describe("BlockPriority", () => {

  it('basic logic order', () => {
    let job = new Job();


    let p0 = job.createBlock('p0');
    let p1 = job.createBlock('p1');
    let p2 = job.createBlock('p2');
    let p3 = job.createBlock('p3');

    p0.setValue('@log', 'p0');
    p1.setValue('@log', 'p1');
    p2.setValue('@log', 'p2');
    p3.setValue('@log', 'p3');

    p3.setValue('#class', 'test-runner');
    p0.setValue('#class', 'test-runner');
    p1.setValue('#class', 'test-runner');
    p2.setValue('#class', 'test-runner');
    Root.run();

    assert.deepEqual(TestLogicRunner.logs,
      ['p3', 'p0', 'p1', 'p2'],
      'logic should run in the same order as class is set');
    TestLogicRunner.clearLog();

    assert.deepEqual(TestLogicRunner.logs, [], 'logs should be cleared');

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    assert.deepEqual(TestLogicRunner.logs,
      ['p3', 'p1', 'p2', 'p0'],
      'logic should run in the same order as they are called');
    TestLogicRunner.clearLog();

    p1.setValue('#priority', 1);
    p3.setValue('#priority', 3);
    p0.setValue('#priority', 0);
    p2.setValue('#priority', 2);

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    assert.deepEqual(TestLogicRunner.logs,
      ['p0', 'p1', 'p2', 'p3'],
      'logic should run in the same order as their priority');
    TestLogicRunner.clearLog();
    
  });
});
