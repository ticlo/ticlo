import { assert } from "chai";
import { NestedJob } from "../NestedJob";
import { Job, Root } from "../../block/Job";
import { Block } from "../../block/Block";
import { TestFunctionRunner } from "../../block/spec/TestFunction";

describe("NestedJob", () => {

  it('basic', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#class', '/NestedJob/class1');

    NestedJob.registerClass('/NestedJob/class1',
      {
        'runner': {'#class': 'test-runner', '@log': 'nest1', '~#call': '##.#input.in1'}
      });

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['nest1'],
      'nested job should be created');
    TestFunctionRunner.clearLog();

    aBlock.setValue('in1', 1);
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['nest1'],
      'nested job triggered with binding');
    TestFunctionRunner.clearLog();

    aBlock.setValue('in1', 2);
    aBlock.setValue('#class', null);
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs,
      'nested job destroy');
  });
});
