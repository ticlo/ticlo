import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";

describe("Block", () => {

  it('basic', () => {
    let job = new Job();
    job.setValue('@a', 357);
    job.setBinding('@b', '@a');
    assert.equal(job.getValue('@b'), 357, 'basic binding');

    let block = job.createBlock('obj');
    assert.equal(block instanceof Block, true, 'createBlock');
    assert.equal(block, job.getValue('obj'), 'get child block');


    block.setValue('@c', 468);
    job.setBinding('@d', 'obj.@c');
    assert.equal(job.getValue('@d'), 468, 'path binding');

    block.setBinding('@e', '##.@b');
    assert.equal(block.getValue('@e'), 357, 'parent binding');

    block.setBinding('@f', '###.@a');
    assert.equal(block.getValue('@f'), 357, 'job binding');
  });


});
