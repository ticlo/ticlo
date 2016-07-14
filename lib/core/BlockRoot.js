'use strict';

const Block = require('./Block').Block;
const BlockChild = require('./BlockChild').BlockChild;

/**
 * @constructor
 * @extends {Block}
 */
function BlockRoot() {
    Block.call(this, this, new BlockChild(this, ''));
}
module.exports.BlockRoot = BlockRoot;

BlockRoot.prototype = Object.create(Block.prototype);