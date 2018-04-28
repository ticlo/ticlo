import { assert } from "chai";
import { TestFunctionRunner } from "./TestFunction";
import { Job, Root } from "../Job";

describe("BlockControl", () => {

  it('readonly control', () => {
    let job = new Job();

    let block = job.createBlock('obj');

    assert.equal(block.getValue('#parent'), job, 'get #parent');
    assert.equal(block.getValue('#job'), job, 'get #job');

    block.setValue('#parent', 1);
    assert.equal(block.getValue('#parent'), job, 'readonly property setValue');

    block.updateValue('#parent', 1);
    assert.equal(block.getValue('#parent'), job, 'readonly property updateValue');

    block.setValue('a', 1);
    block.setBinding('#parent', 'a');
    assert.equal(block.getValue('#parent'), job, 'readonly property setBinding');

  });
});