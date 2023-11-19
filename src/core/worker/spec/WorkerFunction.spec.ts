import expect from 'expect';
import {Flow, Root} from '../../block/Flow';
import {WorkerFunction} from '../WorkerFunction';
import {TestFunctionRunner} from '../../block/spec/TestFunction';
import '../../functions/math/Arithmetic';
import {DataMap} from '../../util/DataTypes';

describe('WorkerFunction', function () {
  it('basic', function () {
    TestFunctionRunner.clearLog();
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class1');

    let flowData: DataMap = {
      '#is': '',
      'runner': {
        '#is': 'test-runner',
        '#-log': 'nest1',
        '~#call': '##.#inputs.in1',
      },
    };
    WorkerFunction.registerType(flowData, {name: 'class1'}, 'WorkerFunction');

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['nest1']);

    let impl: Flow = aBlock.getValue('#flow') as Flow;
    expect(impl).toBeInstanceOf(Flow);

    expect(impl.save()).toEqual(flowData);

    aBlock.setValue('in1', 1);
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['nest1']);

    aBlock.setValue('in1', 2);
    aBlock.setValue('#is', null);
    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    expect(impl.save()).toEqual(flowData);
  });

  it('output', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class2');

    let flowData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#inputs.in1', '1': 1},
      '#outputs': {'#is': '', '~out1': '##.add.#output'},
    };
    WorkerFunction.registerType(flowData, {name: 'class2'}, 'WorkerFunction');
    aBlock.setValue('in1', 2);
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });

  it('namespace', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', 'test_namespace:class1');

    let flowData1: DataMap = {
      '#is': '',
      'nest': {'#is': ':class2', '~in1': '##.#inputs.in0'},
      '#outputs': {'#is': '', '~out1': '##.nest.out2'},
    };
    let flowData2: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#inputs.in1', '1': 1},
      '#outputs': {'#is': '', '~out2': '##.add.#output'},
    };
    WorkerFunction.registerType(flowData1, {name: 'class1'}, 'test_namespace');
    WorkerFunction.registerType(flowData2, {name: 'class2'}, 'test_namespace');
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });
});
