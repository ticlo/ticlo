import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";

describe("Block", () => {

  it('query property', () => {
    let job = new Job();
    let block1 = job.createBlock('block1');
    let block2 = block1.createBlock('block2');
    block2.setValue('p1', 1);

    assert.isTrue(job.queryProperty("block3.p2", true) == null, 'query on non-exist block');
    assert.equal(job.queryProperty("block1.block2.p1").getValue(), 1, 'query on existing property');
    assert.isTrue(job.queryProperty("block1.block2.p2") == null, 'query on non-exist property');
    assert.isTrue(job.queryProperty("block1.block2.p3", true) != null, 'query and create property');

  });
  
});
