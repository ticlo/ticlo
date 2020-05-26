import {assert} from 'chai';
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
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

    block.setValue('#disabled', true);
    block.setValue('#call', {});
    block.setValue('input', {});
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs);

    block.setValue('#disabled', undefined);
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

    block.setValue('#disabled', true);
    block.setValue('#mode', 'onChange');
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs);

    block.setValue('#disabled', undefined);
    Root.run();
    assert.isEmpty(TestFunctionRunner.logs, 'turn disabled to false while mode is onChange should not cause update');

    block.setValue('input', {});
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

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
    assert.isEmpty(TestFunctionRunner.logs);

    subFlow.setValue('#disabled', false);

    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);

    flow.setValue('#disabled', true);
    block.setValue('#call', {});

    Root.run();
    assert.isEmpty(TestFunctionRunner.logs);

    flow.setValue('#disabled', false);
    Root.run();
    assert.deepEqual(TestFunctionRunner.popLogs(), ['obj']);
    
    flow.destroy();
  });
});
