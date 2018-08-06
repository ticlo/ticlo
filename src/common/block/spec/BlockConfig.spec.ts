import {assert} from "chai";
import {TestFunctionRunner} from "./TestFunction";
import {Job, Root} from "../Block";

describe("BlockConfig", () => {

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

  it('#is', () => {
    let job = new Job();

    let block = job.createBlock('obj');

    assert.equal(block.getValue('#is'), '', '#is "" by default');

    block.setValue('@is', 'add');
    block.setBinding('#is', '@is');
    assert.equal(block.getValue('#is'), 'add', '#is with binding');
    assert.deepEqual(job.save(), {'#is': '', 'obj': {'@is': 'add', '~#is': '@is'}}, 'save #is');

    block.setBinding('#is', null);
    assert.equal(block.getValue('#is'), '', '#is revert back to "" after unbind');
    assert.deepEqual(job.save(), {'#is': '', 'obj': {'@is': 'add', '#is': ''}}, 'save #is');
  });
});
