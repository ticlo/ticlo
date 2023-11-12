import expect from 'expect';
import {Block} from '../../../block/Block';
import {Flow, Root} from '../../../block/Flow';
import {WAIT} from '../../../block/Event';
import {shouldReject, shouldTimeout} from '../../../util/test-util';
import '../Js';

describe('Js', function () {
  it('basic', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'this["out1"] = this["in1"]');
    aBlock.setValue('in1', 321);
    Root.run();

    expect(aBlock.getValue('out1')).toEqual(321);
  });

  it('nested function', function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');

    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'let temp = 456; return function(){this["out2"] = ++temp;}');

    Root.run();
    expect(aBlock.getValue('out2')).toEqual(457);

    aBlock.updateValue('#call', {});
    Root.run();
    expect(aBlock.getValue('out2')).toEqual(458);

    // save load
    let saved = flow.save();
    let flow2 = new Flow();
    flow2.load(saved);

    let aBlock2 = flow2.getValue('a');
    expect(aBlock2).toBeInstanceOf(Block);
    Root.run();
    expect(aBlock2.getValue('out2')).toEqual(457);
  });

  it('errors', async function () {
    let flow = new Flow();

    let aBlock = flow.createBlock('a');
    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'throw new Error("")');
    await shouldReject(aBlock.waitNextValue('#emit'));

    aBlock.deleteValue('#emit');
    aBlock.setValue('script', undefined);
    await shouldTimeout(aBlock.waitNextValue('#emit'), 5);
    expect(aBlock.getValue('#emit')).not.toBeDefined();

    aBlock.setValue('#call', {});
    await shouldTimeout(aBlock.waitNextValue('#emit'), 5); // NOT_READY won't resolve the promise
    expect(aBlock.getValue('#emit')).toEqual(WAIT);

    let bBlock = flow.createBlock('b');
    bBlock.setValue('#is', 'js');
    bBlock.setValue('script', 'return function(){throw new Error("");}'); // nested function
    await shouldReject(bBlock.waitNextValue('#emit'));

    let cBlock = flow.createBlock('c');
    cBlock.setValue('#is', 'js');
    cBlock.setValue('script', true); // invalid script
    await shouldReject(cBlock.waitNextValue('#emit'));

    let dBlock = flow.createBlock('d');
    dBlock.setValue('#is', 'js');
    dBlock.setValue('script', '}'); // invalid script
    await shouldReject(dBlock.waitNextValue('#emit'));
  });
});
