import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';

describe('Disabled Block', function () {
  it('disabled block', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#mode', 'onLoad');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('#disabled', true);
    block.setValue('#call', {});
    block.setValue('input', {});
    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    block.setValue('#disabled', undefined);
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('#disabled', true);
    block.setValue('#mode', 'onChange');
    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    block.setValue('#disabled', undefined);
    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    block.setValue('input', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    flow.destroy();
  });

  it('disable flow', function () {
    let flow = new Flow();
    let flowProp = flow.getProperty('sub', true);

    let subFlow = new Flow(flow, null, flowProp);
    flowProp.setValue(subFlow);

    subFlow.setValue('#disabled', true);

    let block = subFlow.createBlock('obj');
    block.setValue('#mode', 'onLoad');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');

    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    subFlow.setValue('#disabled', false);

    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    flow.setValue('#disabled', true);
    block.setValue('#call', {});

    Root.run();
    expect(TestFunctionRunner.logs).toEqual([]);

    flow.setValue('#disabled', false);
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    flow.destroy();
  });
});
