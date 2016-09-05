const assert = require('assert');

const Bz = require('../src/breezeflow.js');
const Block = Bz.Block;
const BlockRoot = Bz.BlockRoot;
const Loop = Bz.Loop;

describe("Script", function () {
    it('basic', function () {
        var model = new BlockRoot();

        let aBlock = model.createBlock('a');

        aBlock.setValue('>>type', 'js');
        aBlock.setValue('>script', 'this["<out1"] = 321');
        Loop.run();

        assert.equal(aBlock.getValue('<out1'), 321, 'basic script output');
    });

    it('nested function', function () {
        var model = new BlockRoot();

        let aBlock = model.createBlock('a');

        aBlock.setValue('>>type', 'js');
        aBlock.setValue('>script', 'return function(){this["<out2"] = 456}');
        Loop.run();

        assert.equal(aBlock.getValue('<out2'), 456, 'basic script output');
    });
});
