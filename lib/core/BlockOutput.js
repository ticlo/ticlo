'use strict';

const BlockProperty = require('./BlockProperty').BlockProperty;

/**
 * @constructor
 * @extends {BlockProperty}
 * @param {Block} block
 * @param {string} name
 */
function BlockOutput(block, name) {
    BlockProperty.call(this, block, name);
}
module.exports.BlockOutput = BlockOutput;

BlockOutput.prototype = Object.create(BlockProperty.prototype);
