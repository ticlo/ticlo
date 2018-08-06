import {assert} from "chai";
import {Job, Root} from "../../block/Block";
import {WorkerFunction} from "../WorkerFunction";
import {Block} from "../../block/Block";
import {TestFunctionRunner} from "../../block/spec/TestFunction";
import "../../functions/basic/Math";
import "../Output";
import {DataMap} from "../../util/Types";

describe("WorkerFunction", () => {

  it('basic', () => {
    TestFunctionRunner.clearLog();
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', '/WorkerFunction/class1');

    let jobData: DataMap = {
      '#is': '',
      'runner': {'#is': 'test-runner', '#-log': 'nest1', '~#call': '##.#input.in1'}
    };
    WorkerFunction.registerClass('/WorkerFunction/class1', jobData);

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

  it('output', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', '/WorkerFunction/class2');

    let jobData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': 'output', '~out1': '##.add.output'}
    };
    WorkerFunction.registerClass('/WorkerFunction/class2', jobData);
    aBlock.setValue('in1', 2);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from nested logic');
  });

  it('namespace', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', 'job_test_namespace/class1');

    let jobData1: DataMap = {
      '#is': '',
      'nest': {'#is': '/class2', '~in1': '##.#input.in0'},
      '#output': {'#is': 'output', '~out1': '##.nest.out2'}
    };
    let jobData2: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#input.in1', '1': 1},
      '#output': {'#is': 'output', '~out2': '##.add.output'}
    };
    WorkerFunction.registerClass('job_test_namespace/class1', jobData1);
    WorkerFunction.registerClass('job_test_namespace/class2', jobData2);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 3, 'output from 2 layer of  nested logic');
  });
});
