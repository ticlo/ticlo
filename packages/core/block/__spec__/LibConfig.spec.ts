import {expect} from 'vitest';
import {Flow, Root} from '../Flow.js';

describe('NamespaceConfig', function () {
  it('get #+ value', function () {
    const flowLib = Root.instance.addFlowFolder('+libConfigNs1');
    const flowTest = Root.instance.addFlow('libConfigTest1');
    flowTest.load({}, null, null, null, '+libConfigNs1');
    expect(flowTest.getValue('#+')).toBe(flowLib);

    Root.instance.deleteValue('libConfigTest1');
    Root.instance.deleteValue('libConfigNs1');
  });

  it('bind #+ value', function () {
    const flowTest = Root.instance.addFlow('libConfigTest2');
    flowTest.load({}, null, null, null, '+libConfigNs2');
    expect(flowTest.getValue('#+')).toBeUndefined();

    const flowLib = Root.instance.addFlowFolder('+libConfigNs2');
    expect(flowTest.getValue('#+')).toBe(flowLib);

    Root.instance.deleteValue('libConfigTest2');
    Root.instance.deleteValue('libConfigNs2');
  });
});
