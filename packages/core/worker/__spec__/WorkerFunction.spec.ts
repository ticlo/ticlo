import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {WorkerFunctionGen} from '../WorkerFunctionGen.js';
import {TestFunctionRunner} from '../../block/__spec__/TestFunction.js';
import '../../functions/math/Arithmetic.js';
import type {DataMap} from '../../util/DataTypes.js';

describe('WorkerFunction', function () {
  it('basic', function () {
    TestFunctionRunner.clearLog();
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class1');

    const flowData: DataMap = {
      '#is': '',
      'runner': {
        '#is': 'test-runner',
        '#-log': 'nest1',
        '~#call': '##.#inputs.in1',
      },
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class1'}, 'WorkerFunction');

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['nest1']);

    const impl: Flow = aBlock.getValue('#flow') as Flow;
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
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'WorkerFunction:class2');

    const flowData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#inputs.in1', '1': 1},
      '#outputs': {'#is': '', '~out1': '##.add.#output'},
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class2'}, 'WorkerFunction');
    aBlock.setValue('in1', 2);
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });

  it('namespace', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', 'test_namespace:class1');

    const flowData1: DataMap = {
      '#is': '',
      'nest': {'#is': ':class2', '~in1': '##.#inputs.in0'},
      '#outputs': {'#is': '', '~out1': '##.nest.out2'},
    };
    const flowData2: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#inputs.in1', '1': 1},
      '#outputs': {'#is': '', '~out2': '##.add.#output'},
    };
    WorkerFunctionGen.registerType(flowData1, {name: 'class1'}, 'test_namespace');
    WorkerFunctionGen.registerType(flowData2, {name: 'class2'}, 'test_namespace');
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });
});
