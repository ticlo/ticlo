'use strict';


const Block = require('./Block').Block;

/**
 * @constructor
 * @extends {Block}
 */
function BlockRoot() {
    //TODO create selfProp
    Block.call(this, this, null);
}
module.exports.BlockRoot = BlockRoot;

BlockRoot.prototype = Object.create(Block.prototype);