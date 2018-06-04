import { assert } from "chai";
import { NestedJob } from "../NestedJob";
import { Job, Root } from "../../block/Job";
import { Block, SavedData } from "../../block/Block";
import { TestFunctionRunner } from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../Output";

describe("NestedJob", () => {

  it('basic', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', '/NestedJob/class1');

    let jobData: SavedData = {
      '#is': null,
      'runner': {'#is': 'test-runner', '@log': 'nest1', '~#call': '##.#input.in1'}
    };
    NestedJob.registerClass('/NestedJob/class1', jobData);

    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['nest1'],
      'nested job should be created');
    TestFunctionRunner.clearLog();

    let impl: Job = aBlock.getValue('#impl')  as Job;
    assert.instanceOf(impl, Job, 'get #impl of nested job');

    assert.deepEqual(impl.save(), jobData, 'serialize nested job');

    aBlock.setValue('in1', 1);
    Root.run();
    assert.deepEqual(TestFunctionRunner.logs, ['nest1'],
      'nested job triggered with binding');
    TestFunctionRunner.clearLog();

    aBlock.setValue('in1', 2);
    aBlock.setValue('#is', null);
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs, 'nested job destroy');

    assert.deepEqual(impl.save(), jobData, 'serialize nested job after destroy');
  });

  it('output', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', '/NestedJob/class2');

    let jobData: SavedData = {
      '#is': null,
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': 'output', '~out1': '##.add.output'}
    };
    NestedJob.registerClass('/NestedJob/class2', jobData);
    aBlock.setValue('in1', 2);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from nested logic');
  });

  it('namespace', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', 'job_test_namespace/class1');

    let jobData1: SavedData = {
      '#is': null,
      'nest': {'#is': '/class2', '~in1': '##.#input.in0'},
      '#output': {'#is': 'output', '~out1': '##.nest.out2'}
    };
    let jobData2: SavedData = {
      '#is': null,
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': 'output', '~out2': '##.add.output'}
    };
    NestedJob.registerClass('job_test_namespace/class1', jobData1);
    NestedJob.registerClass('job_test_namespace/class2', jobData2);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from 2 layer of  nested logic');
  });
});
