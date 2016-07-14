'use strict';

const BlockProperty = require('./BlockProperty').BlockProperty;

/**
 * @constructor
 * @extends {BlockProperty}
 * @param {Block} block
 * @param {string} name
 */
function BlockMeta(block, name) {
    BlockProperty.call(this, block, name);
}
module.exports.BlockMeta = BlockMeta;

BlockMeta.prototype = Object.create(BlockProperty.prototype);
