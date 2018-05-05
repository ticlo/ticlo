import { assert } from "chai";
import { TestFunctionRunner } from "./TestFunction";
import { Job, Root } from "../Job";

describe("BlockControl", () => {

  it('readonly control', () => {
    let job = new Job();

    let block = job.createBlock('obj');

    assert.equal(block.getValue('##'), job, 'get ##');
    assert.equal(block.getValue('###'), job, 'get ###');

    block.setValue('##', 1);
    assert.equal(block.getValue('##'), job, 'readonly property setValue');

    block.updateValue('##', 1);
    assert.equal(block.getValue('##'), job, 'readonly property updateValue');

    block.setValue('a', 1);
    block.setBinding('##', 'a');
    assert.equal(block.getValue('##'), job, 'readonly property setBinding');

  });
});
