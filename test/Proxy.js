const assert = require('assert');

const Bz = require('../src/breezeflow.js');
const Block = Bz.Block;
const BlockRoot = Bz.BlockRoot;
const Loop = Bz.Loop;

describe("Proxy", function () {
    it('Proxy', function () {
        var model = new BlockRoot();

        let aBlock = model.createBlock('a');

        aBlock.setValue('>>type', '+');
        aBlock.setValue('>0', 2);
        aBlock.setValue('>1', 3);
        Loop.run();

        let proxy = aBlock.getProxy();

        assert.equal(proxy[">0"], 2, 'direct reading');
        assert.equal(proxy.$in['0'], 2, 'input reading');
        assert.equal(proxy.$out.out, 5, 'output reading');

        proxy.$in['1'] = 7;
        Loop.run();
        assert.equal(proxy.$out.out, 9, 'input writing');
    });

});
