const assert = require('assert');

const Bz = require('../src/bzflow/bzflow.js');
const Block = Bz.Block;
const BlockRoot = Bz.BlockRoot;
const Loop = Bz.Loop;
const Types = Bz.Types;
const Add = Bz.Add;

describe("Block", function () {
    it('basic', function () {
        var model = new BlockRoot();
        model.setValue('@a', 357);
        model.setBinding('@b', '@a');
        assert.equal(model.getValue('@b'), 357, 'basic binding');

        model.createBlock('obj');
        let block = model.getValue('obj');
        assert.equal(block instanceof Block, true, 'createBlock');

        block.setValue('@c', 468);
        model.setBinding('@d', 'obj.@c');
        assert.equal(model.getValue('@d'), 468, 'path binding');
    });

});
