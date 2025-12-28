import {expect} from 'vitest';
import {Flow, Root} from '../../../block/Flow.js';
import {JsFunction} from '../Js.js';
import {Functions} from '../../../block/Functions.js';
import {TestLogger} from '../../../util/__spec__/Logger.spec.js';
import {Logger} from '../../../util/Logger.js';

describe('Js Type', function () {
  it('basic', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('in1', 321);
    aBlock.setValue('#is', 'Js-type1');

    JsFunction.registerType('this["out1"] = this["in1"]', {
      name: 'Js-type1',
      priority: 1,
      mode: 'onCall',
    });

    Root.run();
    expect(aBlock.getValue('out1')).not.toBeDefined();
    aBlock.setValue('#call', {});

    Root.run();
    expect(aBlock.getValue('out1')).toBe(321);
    Functions.clear('Js-type1');
  });

  it('unregister class', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'Js-type2');
    JsFunction.registerType('this["out1"] = 1', {name: 'Js-type2'});

    expect(aBlock._queued).toBeTruthy();
    Functions.clear('Js-type2');
    Root.run();
    expect(!aBlock._queued).toBeTruthy();
    expect(aBlock.getValue('out1')).not.toBeDefined();
    Functions.clear('Js-type2');
  });

  it('invalid script', function () {
    const logger = new TestLogger(Logger.ERROR);
    expect(JsFunction.registerType('[[', {name: 'Js-type3'})).toBe(false);
    expect(logger.logs).toEqual(['invalid script:\n[[']);
    logger.cancel();
  });

  it('trivial', function () {
    const flow = new Flow();

    const aBlock = flow.createBlock('a');
    Functions.clear('');
    expect(Functions.getDescToSend('')).toEqual([null, 0]);
    expect(Functions.listen('', aBlock)).not.toBeDefined();
  });
});
