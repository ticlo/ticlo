var assert = require('assert');

const Block = require('../lib/core/Block').Block;
const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;
const Loop = require('../lib/core/Loop').Loop;
const Types = require('../lib/core/Types').Types;
const Add = require('../lib/logic/basic/Add').Add;

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

    it('add', function () {
        var model = new BlockRoot();

        let addBlock = model.createBlock('add');

        addBlock.setValue('>>type', '+');
        addBlock.setValue('>0', 2);
        addBlock.setValue('>1', 3);

        Loop.run();
        assert.equal(addBlock.getValue('<out'), 5, '2+3==5');

        addBlock = model.createBlock('add2');


        addBlock.setValue('>0', 2.5);
        addBlock.setValue('>1', 3.5);
        addBlock.setValue('>>type', '+');

        Loop.run();
        assert.equal(addBlock.getValue('<out'), 6, 'update type after value, 2.5+3.5==6');
    });
});
