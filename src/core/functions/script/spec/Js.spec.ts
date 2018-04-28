import { assert } from "chai";
import "../Js";
import { Job, Root } from "../../../block/Job";
import { Block } from "../../../block/Block";

describe("Script", () => {
  it('basic', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#class', 'js');
    aBlock.setValue('script', 'this["out1"] = this["in1"]');
    aBlock.setValue('in1', 321);
    Root.run();

    assert.equal(aBlock.getValue('out1'), 321, 'basic script output');
  });

  it('nested function', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#class', 'js');
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
});
