
var assert = require('assert');

describe('basic class test', function(){
    it('instanceof', function(){
        const Block = require('../lib/core/Block').Block;
        const BlockRoot = require('../lib/core/BlockRoot').BlockRoot;

        let b = new BlockRoot(null, 1);

        assert(b instanceof(Block));
    });
});
