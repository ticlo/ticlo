import * as assert from "assert";
import "../Math";
import {Job} from "../../../core/Job";
import {Loop} from "../../../core/Loop";

describe("Math", () => {

  it('basic add', () => {
    let root = new Job();

    let aBlock = root.createBlock('a');

    aBlock.setValue('#class', 'add');
    aBlock.setValue('0', 2);
    aBlock.setValue('1', 3);

    Loop.run();
    console.log("---------", aBlock.getValue('output'));
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

});
