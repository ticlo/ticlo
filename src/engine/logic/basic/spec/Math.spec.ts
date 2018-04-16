import * as assert from "assert";
import "../Math";
import { Job } from "../../../core/Job";
import { Loop } from "../../../core/Loop";

describe("Math", () => {

  it('basic add', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);

    Loop.run();

    assert.equal(aBlock.getValue('output'), 5, '2+3 == 5');

    aBlock.setValue('0', 4);

    Loop.run();
    assert.equal(aBlock.getValue('output'), 7, 'update parameter, 4+3 == 5');

    aBlock = root.createBlock('a2');

    // set class last
    aBlock.setValue('0', 2.5);
    aBlock.setValue('1', 3.5);
    aBlock.setValue('#class', 'add');

    Loop.run();
    assert.equal(aBlock.getValue('output'), 6, 'update type after value, 2.5+3.5==6');
  });

  it('add multiple', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 4);
    aBlock.setValue('#length', 3);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 9, '2+3+4 == 9');

    aBlock.setValue('3', 5);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 9, 'add new value but length is not changed');

    aBlock.setValue('#length', 4);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 14, '2+3+4+5 == 14');

    aBlock.setValue('#length', 2);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 5, 'length back to 2, 2+3 == 5');
  });

  it('subtract', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'subtract');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 3);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 4, '7-3 == 4');
  });

  it('divide', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'divide');
    aBlock.setValue('0', 7);
    aBlock.setValue('1', 2);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 3.5, '7/2 == 3.5');
  });

  it('multiply', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'multiply');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);
    aBlock.setValue('2', 5);
    aBlock.setValue('#length', 3);
    Loop.run();
    assert.equal(aBlock.getValue('output'), 30, '2*3*5 == 30');
  });

});
