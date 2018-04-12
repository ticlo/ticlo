import * as assert from "assert";
import {Block} from "../Block";

import {Job} from "../Job";

describe("Block", () => {

  it('basic', () => {
    let root = new Job();
    root.setValue('@a', 357);
    root.setBinding('@b', '@a');
    assert.equal(root.getValue('@b'), 357, 'basic binding');

    root.createBlock('obj');
    let block = root.getValue('obj');
    assert.equal(block instanceof Block, true, 'createBlock');

    block.setValue('@c', 468);
    root.setBinding('@d', 'obj.@c');
    assert.equal(root.getValue('@d'), 468, 'path binding');
  });

});
