import {assert} from "chai";
import "../Math";
import {Job, Root, Block} from "../../../block/Block";

describe("Math", () => {

  it('basic add', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);

    Root.run();

    assert.equal(aBlock.getValue('output'), 5, '2+3 == 5');

    aBlock.setValue('0', 4);

    Root.run();
    assert.equal(aBlock.getValue('output'), 7, 'update parameter, 4+3 == 5');

    aBlock = job.createBlock('a2');

    // set class last
    aBlock.setValue('0', 2.5);
    aBlock.setValue('1', 3.5);
    aBlock.setValue('#is', 'add');

    Root.run();
    assert.equal(aBlock.getValue('output'), 6, 'update type after value, 2.5+3.5==6');

    // save load
    let saved = job._save();
    let job2 = new Job();
    job2.load(saved);

    let aBlock2 = job2.getValue('a2');
    assert.instanceOf(aBlock2, Block, "load add block from saved data");
    Root.run();
    assert.equal(aBlock2.getValue('output'), 6, 'run add function after loading saved data');
  });

  it('add multiple', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 4);
    aBlock.setValue('#length', 3);
    Root.run();
    assert.equal(aBlock.getValue('output'), 9, '2+3+4 == 9');

    aBlock.setValue('3', 5);
    Root.run();
    assert.equal(aBlock.getValue('output'), 9, 'add new value but length is not changed');

    aBlock.setValue('#length', 4);
    Root.run();
    assert.equal(aBlock.getValue('output'), 14, '2+3+4+5 == 14');

    aBlock.setValue('#length', 2);
    Root.run();
    assert.equal(aBlock.getValue('output'), 5, 'length back to 2, 2+3 == 5');

    aBlock.setValue('#length', 0);
    Root.run();
    assert.equal(aBlock.getValue('output'), null, 'return null when add nothing');
  });

  it('subtract', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'subtract');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 3);
    Root.run();
    assert.equal(aBlock.getValue('output'), 4, '7-3 == 4');

    aBlock.setValue('1', null);
    Root.run();
    assert.equal(aBlock.getValue('output'), null, '7-null == null');
  });

  it('divide', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'divide');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 2);
    Root.run();
    assert.equal(aBlock.getValue('output'), 3.5, '7/2 == 3.5');

    aBlock.setValue('1', null);
    Root.run();
    assert.equal(aBlock.getValue('output'), null, '7/null == null');
  });

  it('multiply', () => {
    let job = new Job();

    let aBlock = job.createBlock('a');

    aBlock.setValue('#is', 'multiply');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 5);
    aBlock.setValue('#length', 3);
    Root.run();
    assert.equal(aBlock.getValue('output'), 30, '2*3*5 == 30');

    aBlock.setValue('2', null);
    Root.run();
    assert.equal(aBlock.getValue('output'), null, '2*3*null == null');

    aBlock.setValue('#length', -1);
    Root.run();
    assert.equal(aBlock.getValue('output'), 6, 'when length is invalid, use length=2');

    aBlock.setValue('#length', 0);
    Root.run();
    assert.equal(aBlock.getValue('output'), null, 'return null when multiply nothing');
  });

});
