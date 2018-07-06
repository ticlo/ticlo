import {assert} from "chai";
import {JsFunction} from "../Js";
import {Job, Root} from "../../../block/Job";
import {Block} from "../../../block/Block";
import {Classes} from "../../../block/Class";

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

  it('js class', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('in1', 321);
    aBlock.setValue('#is', '/Js/class1');

    JsFunction.registerClass('/Js/class1', 'this["out1"] = this["in1"]');

    Root.run();
    assert.equal(aBlock.getValue('out1'), 321, 'basic script output');

  });

  it('unregister class', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');
    aBlock.setValue('#is', '/Js/class2');
    JsFunction.registerClass('/Js/class2', 'this["out1"] = 1');

    assert(aBlock._queued, 'script is _queued');
    Classes.clear('/Js/class2');
    Root.run();
    assert(!aBlock._queued, 'script is no longer _queued');
    assert.isUndefined(aBlock.getValue('out1'), 'clear class after called');
  });
});
