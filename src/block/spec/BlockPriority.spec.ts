import { assert } from "chai";
import { TestFunctionRunner } from "./TestFunction";
import { Job, Root } from "../Job";

describe("BlockPriority", () => {

  it('basic function order', () => {
    TestFunctionRunner.clearLog();

    let job = new Job();

    let p0 = job.createBlock('p0');
    let p1 = job.createBlock('p1');
    let p2 = job.createBlock('p2');
    let p3 = job.createBlock('p3');

    p0.setValue('@log', 'p0');
    p1.setValue('@log', 'p1');
    p2.setValue('@log', 'p2');
    p3.setValue('@log', 'p3');

    p3.setValue('#is', 'test-runner');
    p0.setValue('#is', 'test-runner');
    p1.setValue('#is', 'test-runner');
    p2.setValue('#is', 'test-runner');
    Root.run();

    assert.deepEqual(TestFunctionRunner.logs,
      ['p3', 'p0', 'p1', 'p2'],
      'function should run in the same order as class is set');
    TestFunctionRunner.clearLog();

    assert.deepEqual(TestFunctionRunner.logs, [], 'logs should be cleared');

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    assert.deepEqual(TestFunctionRunner.logs,
      ['p3', 'p1', 'p2', 'p0'],
      'function should run in the same order as they are called');
    TestFunctionRunner.clearLog();

    p1.setValue('#priority', 1);
    p3.setValue('#priority', 3);
    p0.setValue('#priority', 0);
    p2.setValue('#priority', 2);

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    assert.deepEqual(TestFunctionRunner.logs,
      ['p0', 'p1', 'p2', 'p3'],
      'function should run in the same order as their priority');

  });

  it('order from binding', () => {
    let job = new Job();

    let p2 = job.createBlock('p2');
    let p0 = job.createBlock('p0');
    let p1 = job.createBlock('p1');
    let p3 = job.createBlock('p3');

    p3.setValue('@log', 'p3');
    p0.setValue('@log', 'p0');
    p2.setValue('@log', 'p2');
    p1.setValue('@log', 'p1');

    p1.setBinding('input', '##.p0.input');
    p2.setBinding('input', '##.p1.input');
    p3.setBinding('input', '##.p2.input');

    p3.setValue('#is', 'test-runner');
    p0.setValue('#is', 'test-runner');
    p1.setValue('#is', 'test-runner');
    p2.setValue('#is', 'test-runner');
    Root.run();
    TestFunctionRunner.clearLog();

    p0.updateValue('input', {});
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs,
      ['p0', 'p1', 'p2', 'p3'],
      'function should run in the same order as binding chain');

  });
});
