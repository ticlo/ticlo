'use strict';

const BlockProperty = require('./BlockProperty').BlockProperty;

/**
 * @constructor
 * @extends {BlockProperty}
 * @param {Block} block
 * @param {string} name
 */
function BlockInput(block, name) {
    BlockProperty.call(this, block, name);
}
module.exports.BlockInput = BlockInput;

BlockInput.prototype = Object.create(BlockProperty.prototype);
