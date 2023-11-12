import expect from 'expect';
import {Flow, Root} from '../Flow';

describe('HelperProperty', function () {
  it('save load', function () {
    let flow = new Flow();
    let helper = flow.createHelperBlock('v1');
    helper.setValue('#output', 'hello'); // use setValue so it's serialized

    expect(flow.queryValue('~v1.#output')).toEqual('hello');
    expect(flow.getProperty('v1')._bindingPath).toEqual('~v1.#output');
    expect(flow.getValue('v1')).toEqual('hello');

    let saved = flow.save();

    expect(typeof saved['~v1']).toEqual('object');

    helper.output('world');
    expect(flow.getValue('v1')).toEqual('world');

    flow.liveUpdate(saved);
    expect(flow.getValue('v1')).toEqual('hello');

    flow.setValue('v1', 0);

    expect(helper._destroyed).toBe(true);
    expect(flow.queryValue('~v1')).toEqual(undefined);

    flow.liveUpdate(saved);

    expect(flow.queryValue('~v1.#output')).toEqual('hello');
    expect(flow.getProperty('v1')._bindingPath).toEqual('~v1.#output');
    expect(flow.getValue('v1')).toEqual('hello');

    flow.setValue('v2', 1);
    flow.setBinding('v1', 'v2');
    expect(flow.queryValue('~v1.#output')).toEqual(undefined);
    expect(flow.queryValue('~v1')).toEqual(undefined);

    flow.liveUpdate(saved);

    expect(flow.queryValue('~v1.#output')).toEqual('hello');
    expect(flow.getProperty('v1')._bindingPath).toEqual('~v1.#output');
    expect(flow.getValue('v1')).toEqual('hello');

    let flow2 = new Flow();

    flow2.load(saved);
    expect(flow2.queryValue('~v1.#output')).toEqual('hello');
    expect(flow2.getProperty('v1')._bindingPath).toEqual('~v1.#output');
    expect(flow2.getValue('v1')).toEqual('hello');
  });
});
