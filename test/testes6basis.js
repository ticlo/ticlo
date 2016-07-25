var assert = require('assert');
const Block = require('../lib/core/Block').Block;
const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;

describe("Basic", function () {
    it('instanceof', function(){

        let b = new BlockRoot(null, 1);

        assert(b instanceof(Block));
    });

});




