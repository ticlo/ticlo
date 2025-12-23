import {expect} from 'vitest';
import {Flow, Root} from '../Flow.js';

describe('LibConfig', function () {
  it('get #lib value', function () {
    let flowLib = Root.instance.addFlow('libConfigNs1');
    let flowTest = Root.instance.addFlow('libConfigTest1');
    flowTest.load({}, null, null, null, 'libConfigNs1');
    expect(flowTest.getValue('#lib')).toBe(flowLib);

    Root.instance.deleteValue('libConfigTest1');
    Root.instance.deleteValue('libConfigNs1');
  });

  it('bind #lib value', function () {
    let flowTest = Root.instance.addFlow('libConfigTest2');
    flowTest.load({}, null, null, null, 'libConfigNs2');
    expect(flowTest.getValue('#lib')).toBeUndefined();

    let flowLib = Root.instance.addFlow('libConfigNs2');
    expect(flowTest.getValue('#lib')).toBe(flowLib);

    Root.instance.deleteValue('libConfigTest2');
    Root.instance.deleteValue('libConfigNs2');
  });
});
