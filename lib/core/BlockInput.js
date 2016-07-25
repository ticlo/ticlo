'use strict';

const BlockProperty = require('./BlockProperty').BlockProperty;

/**
 * @constructor
 * @extends {BlockProperty}
 * @param {Block} block
 * @param {string} name
 */
function BlockInput(block, name) {
    /** @type {boolean} */
    this._isSysInput = (name.charCodeAt(1) == 62); // >>

    BlockProperty.call(this, block, name);
}
module.exports.BlockInput = BlockInput;

BlockInput.prototype = Object.create(BlockProperty.prototype);


BlockInput.prototype.updateValue = function (val) {
    if (this._value === val) {
        return false;
    }
    this._value = val;
    this.dispatch();
    this._block.inputChanged(this, val);
    return true;
};