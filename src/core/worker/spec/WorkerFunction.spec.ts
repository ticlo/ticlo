import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {WorkerFunction} from "../WorkerFunction";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import {DataMap} from "../../util/Types";

describe("WorkerFunction", function () {

  it('basic', function () {
    TestFunctionRunner.clearLog();
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class1');

    let jobData: DataMap = {
      '#is': '',
      'runner': {'#is': 'test-runner', '#-log': 'nest1', '~#call': '##.#input.in1'}
    };
    WorkerFunction.registerType(jobData, {name: 'class1'}, 'WorkerFunction');

    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['nest1'],
      'nested job should be created');

    let impl: Job = aBlock.getValue('#func')  as Job;
    assert.instanceOf(impl, Job, 'get #func of nested job');

    assert.deepEqual(impl.save(), jobData, 'serialize nested job');

    aBlock.setValue('in1', 1);
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['nest1'],
      'nested job triggered with binding');

    aBlock.setValue('in1', 2);
    aBlock.setValue('#is', null);
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs, 'nested job destroy');

    assert.deepEqual(impl.save(), jobData, 'serialize nested job after destroy');
  });

  it('output', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class2');

    let jobData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': '', '~out1': '##.add.output'}
    };
    WorkerFunction.registerType(jobData, {name: 'class2'}, 'WorkerFunction');
    aBlock.setValue('in1', 2);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from nested logic');
  });

  it('namespace', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', 'test_namespace:class1');

    let jobData1: DataMap = {
      '#is': '',
      'nest': {'#is': ':class2', '~in1': '##.#input.in0'},
      '#output': {'#is': '', '~out1': '##.nest.out2'}
    };
    let jobData2: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': '', '~out2': '##.add.output'}
    };
    WorkerFunction.registerType(jobData1, {name: 'class1'}, 'test_namespace');
    WorkerFunction.registerType(jobData2, {name: 'class2'}, 'test_namespace');
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from 2 layer of  nested logic');
  });
});
