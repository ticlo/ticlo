const assert = require('assert');

const Bz = require('../build/breezeflow');
const Block = Bz.Block;
const BlockRoot = Bz.BlockRoot;
const Loop = Bz.Loop;
const Types = Bz.Types;
const Add = Bz.Add;
const Subtract = Bz.Subtract;

describe("basic", function () {
    it('add', function () {
        var model = new BlockRoot();

        let aBlock = model.createBlock('a');

        aBlock.setValue('>>type', '+');
        aBlock.setValue('>0', 2);
        aBlock.setValue('>1', 3);

        Loop.run();
        assert.equal(aBlock.getValue('<out'), 5, '2+3 == 5');

        aBlock.setValue('>0', 4);

        Loop.run();
        assert.equal(aBlock.getValue('<out'), 7, 'update parameter, 4+3 == 5');

        aBlock = model.createBlock('a2');

        aBlock.setValue('>0', 2.5);
        aBlock.setValue('>1', 3.5);
        aBlock.setValue('>>type', '+');

        Loop.run();
        assert.equal(aBlock.getValue('<out'), 6, 'update type after value, 2.5+3.5==6');
    });

    it('subtract', function () {
        var model = new BlockRoot();

        let aBlock = model.createBlock('a');

        aBlock.setValue('>>type', '-');
        aBlock.setValue('>0', 2);
        aBlock.setValue('>1', 3);

        Loop.run();
        assert.equal(aBlock.getValue('<out'), -1, '2-3 == -1');

        aBlock.setValue('>0', '5');
        Loop.run();
        assert.equal(aBlock.getValue('<out'), 2, '5-3 == 2');

        aBlock.setValue('>1', 't');
        Loop.run();
        assert.equal(isNaN(aBlock.getValue('<out')), true, 'isNaN(5-t) == true');
    });
});