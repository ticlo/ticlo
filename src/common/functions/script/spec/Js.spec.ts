import {assert} from "chai";
import {Job, Root} from "../../../block/Job";
import {JsFunction} from "../Js";
import {Block} from "../../../block/Block";
import {Classes} from "../../../block/Class";
import {shouldReject, shouldTimeout} from "../../../block/spec/TestFunction";
import {NOT_READY} from "../../../block/Event";

describe("Js", () => {
  it('basic', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'this["out1"] = this["in1"]');
    aBlock.setValue('in1', 321);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 321, 'basic script output');
  });

  it('nested function', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'let temp = 456; return function(){this["out2"] = ++temp;}');

    Root.run();
    assert.equal(aBlock.getValue('out2'), 457, 'nested function script output');

    aBlock.updateValue('#call', {});
    Root.run();
    assert.equal(aBlock.getValue('out2'), 458, 'nested function script local value');

    // save load
    let saved = job._save();
    let job2 = new Job();
    job2.load(saved);

    let aBlock2 = job2.getValue('a');
    assert.instanceOf(aBlock2, Block, "load add block from saved data");
    Root.run();
    assert.equal(aBlock2.getValue('out2'), 457, 'run script function after loading saved data');
  });

  it('errors', async () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('#is', 'js');
    aBlock.setValue('script', 'throw new Error("")');
    await shouldReject(aBlock.waitNextValue('#emit'));

    aBlock.deleteValue('#emit');
    aBlock.setValue('script', undefined);
    await shouldTimeout(aBlock.waitNextValue('#emit'), 5);
    assert.isUndefined(aBlock.getValue('#emit'), 'changing script to undefined should not trigger it');

    aBlock.setValue('#call', {});
    await shouldTimeout(aBlock.waitNextValue('#emit'), 5); // NOT_READY won't resolve the promise
    assert.equal(aBlock.getValue('#emit'), NOT_READY, 'called without script should return NOT_READY');

    let bBlock = job.createBlock('b');
    bBlock.setValue('#is', 'js');
    bBlock.setValue('script', 'return function(){throw new Error("");}'); // nested function
    await shouldReject(bBlock.waitNextValue('#emit'));


    let cBlock = job.createBlock('c');
    cBlock.setValue('#is', 'js');
    cBlock.setValue('script', true); // invalid script
    await shouldReject(cBlock.waitNextValue('#emit'));
  });

});
