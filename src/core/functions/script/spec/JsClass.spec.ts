import expect from 'expect';
import {Flow, Root} from '../../../block/Flow';
import {JsFunction} from '../Js';
import {Functions} from '../../../block/Functions';
import {TestLogger} from '../../../util/spec/Logger.spec';
import {Logger} from '../../../util/Logger';

describe('Js Type', function () {
  it('basic', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
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
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
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
    let logger = new TestLogger(Logger.ERROR);
    expect(JsFunction.registerType('[[', {name: 'Js-type3'})).toBe(false);
    expect(logger.logs).toEqual(['invalid script:\n[[']);
    logger.cancel();
  });

  it('trivial', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    Functions.clear('');
    expect(Functions.getDescToSend('')).toEqual([null, 0]);
    expect(Functions.listen('', aBlock)).not.toBeDefined();
  });
});
