'use strict';

const BlockProperty = require('./BlockProperty').BlockProperty;

/**
 * @constructor
 * @extends {BlockProperty}
 * @param {Block} block
 * @param {string} name
 */
function BlockChild(block, name) {
    BlockProperty.call(this, block, name);
}
module.exports.BlockChild = BlockChild;

BlockChild.prototype = Object.create(BlockProperty.prototype);