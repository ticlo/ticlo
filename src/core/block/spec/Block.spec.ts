import { assert } from "chai";
import { Block } from "../Block";

import { Job } from "../Job";

describe("Block", () => {

  it('basic', () => {
    let root = new Job();
    root.setValue('@a', 357);
    root.setBinding('@b', '@a');
    assert.equal(root.getValue('@b'), 357, 'basic binding');

    let block = root.createBlock('obj');
    assert.equal(block instanceof Block, true, 'createBlock');
    assert.equal(block, root.getValue('obj'), 'get child block');


    block.setValue('@c', 468);
    root.setBinding('@d', 'obj.@c');
    assert.equal(root.getValue('@d'), 468, 'path binding');

    block.setBinding('@e', '##.@b');
    assert.equal(block.getValue('@e'), 357, 'parent binding');

    block.setBinding('@f', '###.@a');
    assert.equal(block.getValue('@f'), 357, 'job binding');
  });


});
