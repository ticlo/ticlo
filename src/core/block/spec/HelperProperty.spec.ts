import {assert} from 'chai';
import {Flow, Root} from '../Flow';

describe('HelperProperty', function () {
  it('save load', function () {
    let flow = new Flow();
    let helper = flow.createHelperBlock('v1');
    helper.setValue('#output', 'hello'); // use setValue so it's serialized

    assert.equal(flow.queryValue('~v1.#output'), 'hello');
    assert.equal(flow.getProperty('v1')._bindingPath, '~v1.#output');
    assert.equal(flow.getValue('v1'), 'hello', 'basic output');

    let saved = flow.save();

    assert.equal(typeof saved['~v1'], 'object', 'saved binding is object instead of string');

    helper.output('world');
    assert.equal(flow.getValue('v1'), 'world');

    flow.liveUpdate(saved);
    assert.equal(flow.getValue('v1'), 'hello', 'liveupdate to overwrite the helper block');

    flow.setValue('v1', 0);

    assert.isTrue(helper._destroyed, 'change owner property should destroy the helper block');
    assert.equal(flow.queryValue('~v1'), undefined);

    flow.liveUpdate(saved);

    assert.equal(flow.queryValue('~v1.#output'), 'hello', 'basic live update');
    assert.equal(flow.getProperty('v1')._bindingPath, '~v1.#output');
    assert.equal(flow.getValue('v1'), 'hello', 'basic output');

    flow.setValue('v2', 1);
    flow.setBinding('v1', 'v2');
    assert.equal(flow.queryValue('~v1.#output'), undefined);
    assert.equal(flow.queryValue('~v1'), undefined);

    flow.liveUpdate(saved);

    assert.equal(flow.queryValue('~v1.#output'), 'hello', 'live update from a previous binding');
    assert.equal(flow.getProperty('v1')._bindingPath, '~v1.#output');
    assert.equal(flow.getValue('v1'), 'hello', 'basic output');

    let flow2 = new Flow();

    flow2.load(saved);
    assert.equal(flow2.queryValue('~v1.#output'), 'hello', 'basic save load');
    assert.equal(flow2.getProperty('v1')._bindingPath, '~v1.#output');
    assert.equal(flow2.getValue('v1'), 'hello', 'basic output');
  });
});
