var assert = require('assert');
const Block = require('../lib/core/Block').Block;
const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;

describe("Block", function () {
    it ('Create', function (){
        var model = new BlockRoot();
        model.setValue('a',1);
        model.setBinding('b','a');
        assert.equal(model.getValue('b'), 1);
    });

});
