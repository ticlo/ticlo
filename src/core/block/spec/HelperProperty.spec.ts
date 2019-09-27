import {assert} from 'chai';
import {Job, Root} from '../Block';

describe('HelperProperty', function() {
  it('save load', function() {
    let job = new Job();
    let helper = job.createHelperBlock('v1');
    helper.setValue('output', 'hello'); // use setValue so it's serialized

    assert.equal(job.queryValue('~v1.output'), 'hello');
    assert.equal(job.getProperty('v1')._bindingPath, '~v1.output');
    assert.equal(job.getValue('v1'), 'hello', 'basic output');

    let saved = job.save();

    assert.equal(typeof saved['~v1'], 'object', 'saved binding is object instead of string');

    helper.output('world');
    assert.equal(job.getValue('v1'), 'world');

    job.liveUpdate(saved);
    assert.equal(job.getValue('v1'), 'hello', 'liveupdate to overwrite the helper block');

    job.setValue('v1', 0);

    assert.isTrue(helper._destroyed, 'change owner property should destroy the helper block');
    assert.equal(job.queryValue('~v1'), undefined);

    job.liveUpdate(saved);

    assert.equal(job.queryValue('~v1.output'), 'hello', 'basic live update');
    assert.equal(job.getProperty('v1')._bindingPath, '~v1.output');
    assert.equal(job.getValue('v1'), 'hello', 'basic output');

    job.setValue('v2', 1);
    job.setBinding('v1', 'v2');
    assert.equal(job.queryValue('~v1.output'), undefined);
    assert.equal(job.queryValue('~v1'), undefined);

    job.liveUpdate(saved);

    assert.equal(job.queryValue('~v1.output'), 'hello', 'live update from a previous binding');
    assert.equal(job.getProperty('v1')._bindingPath, '~v1.output');
    assert.equal(job.getValue('v1'), 'hello', 'basic output');

    let job2 = new Job();

    job2.load(saved);
    assert.equal(job2.queryValue('~v1.output'), 'hello', 'basic save load');
    assert.equal(job2.getProperty('v1')._bindingPath, '~v1.output');
    assert.equal(job2.getValue('v1'), 'hello', 'basic output');
  });
});
