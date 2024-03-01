import {expect} from 'vitest';
import {Flow, Root} from '../Flow';

describe('HelperProperty', function () {
  it('save load', function () {
    let flow = new Flow();
    let helper = flow.createHelperBlock('v1');
    helper.setValue('#output', 'hello'); // use setValue so it's serialized

    expect(flow.queryValue('~v1.#output')).toBe('hello');
    expect(flow.getProperty('v1')._bindingPath).toBe('~v1.#output');
    expect(flow.getValue('v1')).toBe('hello');

    let saved = flow.save();

    expect(typeof saved['~v1']).toBe('object');

    helper.output('world');
    expect(flow.getValue('v1')).toBe('world');

    flow.liveUpdate(saved);
    expect(flow.getValue('v1')).toBe('hello');

    flow.setValue('v1', 0);

    expect(helper._destroyed).toBe(true);
    expect(flow.queryValue('~v1')).toBe(undefined);

    flow.liveUpdate(saved);

    expect(flow.queryValue('~v1.#output')).toBe('hello');
    expect(flow.getProperty('v1')._bindingPath).toBe('~v1.#output');
    expect(flow.getValue('v1')).toBe('hello');

    flow.setValue('v2', 1);
    flow.setBinding('v1', 'v2');
    expect(flow.queryValue('~v1.#output')).toBe(undefined);
    expect(flow.queryValue('~v1')).toBe(undefined);

    flow.liveUpdate(saved);

    expect(flow.queryValue('~v1.#output')).toBe('hello');
    expect(flow.getProperty('v1')._bindingPath).toBe('~v1.#output');
    expect(flow.getValue('v1')).toBe('hello');

    let flow2 = new Flow();

    flow2.load(saved);
    expect(flow2.queryValue('~v1.#output')).toBe('hello');
    expect(flow2.getProperty('v1')._bindingPath).toBe('~v1.#output');
    expect(flow2.getValue('v1')).toBe('hello');
  });
});
