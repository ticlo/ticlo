import {assert} from 'chai';
import {Job, Root} from '../../../block/Job';
import {JsFunction} from '../Js';
import {Functions} from '../../../block/Functions';
import {TestLogger} from '../../../util/spec/Logger.spec';
import {Logger} from '../../../util/Logger';

describe('Js Type', function () {
  it('basic', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in1', 321);
    aBlock.setValue('#is', 'Js-type1');

    JsFunction.registerType('this["out1"] = this["in1"]', {
      name: 'Js-type1',
      priority: 1,
      mode: 'onCall',
    });

    Root.run();
    assert.isUndefined(aBlock.getValue('out1'), 'no change yet');
    aBlock.setValue('#call', {});

    Root.run();
    assert.equal(aBlock.getValue('out1'), 321, 'basic script output');
    Functions.clear('Js-type1');
  });

  it('unregister class', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('#is', 'Js-type2');
    JsFunction.registerType('this["out1"] = 1', {name: 'Js-type2'});

    assert(aBlock._queued, 'script is _queued');
    Functions.clear('Js-type2');
    Root.run();
    assert(!aBlock._queued, 'script is no longer _queued');
    assert.isUndefined(aBlock.getValue('out1'), 'clear class after called');
    Functions.clear('Js-type2');
  });

  it('invalid script', function () {
    let logger = new TestLogger(Logger.ERROR);
    assert.isFalse(JsFunction.registerType('[[', {name: 'Js-type3'}));
    assert.deepEqual(logger.logs, ['invalid script:\n[[']);
    logger.cancel();
  });

  it('trivial', function () {
    let job = new Job();

    let aBlock = job.createBlock('a');
    Functions.clear('');
    assert.deepEqual(Functions.getDescToSend(''), [null, 0]);
    assert.isUndefined(Functions.listen('', aBlock), 'listen without class name');
  });
});
