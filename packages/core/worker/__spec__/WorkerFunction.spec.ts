import {expect} from 'vitest';
import {Flow, Root} from '../../block/Flow.js';
import {WorkerFunctionGen} from '../WorkerFunctionGen.js';
import {TestFunctionRunner} from '../../block/__spec__/TestFunction.js';
import '../../functions/math/Arithmetic.js';
import type {DataMap} from '../../util/DataTypes.js';
import {Namespace} from '../../block/Namespace.js';
import {makeLocalConnection} from '../../connect/LocalConnection.js';

describe('WorkerFunction', function () {
  it('basic', function () {
    TestFunctionRunner.clearLog();
    const flow = new Flow();

    const aBlock = flow.createBlock('a');

    aBlock.setValue('#is', '+WorkerFunction::class1');

    const flowData: DataMap = {
      '#is': '',
      'runner': {
        '#is': 'test-runner',
        '#-log': 'nest1',
        '~#call': '##.#inputs.in1',
      },
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class1'}, '+WorkerFunction');

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['nest1']);

    const impl: Flow = aBlock.getValue('#worker') as Flow;
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

    aBlock.setValue('#is', '+WorkerFunction::class2');

    const flowData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '~0': '##.#inputs.in1', '1': 1},
      '#outputs': {'#is': '', '~out1': '##.add.#output'},
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class2'}, '+WorkerFunction');
    aBlock.setValue('in1', 2);
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });

  it('namespace', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('in0', 2);
    aBlock.setValue('#is', '+test_namespace::class1');

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
    WorkerFunctionGen.registerType(flowData1, {name: 'class1'}, '+test_namespace');
    WorkerFunctionGen.registerType(flowData2, {name: 'class2'}, '+test_namespace');
    Root.run();

    expect(aBlock.getValue('out1')).toBe(3);
  });

  it('supports save and undo from runtime worker flow', async function () {
    const funcId = '+WorkerFunctionRuntimeEdit::class1';
    const flowData: DataMap = {
      '#is': '',
      'add': {'#is': 'add', '0': 1, '1': 2},
    };
    WorkerFunctionGen.registerType(flowData, {name: 'class1'}, '+WorkerFunctionRuntimeEdit');

    const flow = Root.instance.addFlow('WorkerFunctionRuntimeEdit');
    flow.load({'#is': '', 'fn': {'#is': funcId}}, null, (flow) => flow.save());
    Root.run();

    const workerPath = 'WorkerFunctionRuntimeEdit.fn.#worker';
    let worker = Root.instance.queryValue(workerPath) as Flow;
    const [, client] = makeLocalConnection(Root.instance, false);

    client.watch(workerPath, {});
    await client.setValue(`${workerPath}.extra`, 1, true);
    expect(worker.getValue('@has-change')).toBe(true);
    expect(worker.getValue('@has-undo')).toBe(true);

    await client.undo(workerPath);
    expect(worker.getValue('extra')).not.toBeDefined();

    await client.redo(workerPath);
    expect(worker.getValue('extra')).toBe(1);

    await client.applyFlowChange(workerPath);
    const [, workerData] = Namespace.getWorker(funcId);
    expect(workerData).toEqual({...flowData, extra: 1});
    Root.run();
    worker = Root.instance.queryValue(workerPath) as Flow;
    expect(worker.getValue('@has-change')).not.toBeDefined();

    client.destroy();
    Root.instance.deleteValue('WorkerFunctionRuntimeEdit');
    Namespace.delete(funcId);
  });
});
