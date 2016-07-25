var assert = require('assert');
const Block = require('../lib/core/Block').Block;
const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;

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
