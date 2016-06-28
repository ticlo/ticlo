'use strict';

const Block = require('./Block');

/**
 * @constructor
 * @extends {Block}
 */
function BlockRoot() {
    Block.call(this);
}
BlockRoot.prototype = Object.create(Block.prototype);

module.exports = BlockRoot;
