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

BlockChild.prototype.updateValue = function (val) {
    if (!(val instanceof Block)) {
        val = null;
    }
    if (this._value === val) {
        return false;
    }
    if (this._saved && this._saved != val) {
        this._saved.destroy();
        this._saved = null;
    }
    this._value = val;
    this.dispatch();
    return true;
};

BlockChild.prototype.setValue = function (val) {
    if (!(val instanceof Block)) {
        val = null;
    }
    if (this._bindingRef) {
        this._bindingRef.remove();
        this._bindingPath = null;
        this._bindingRef = null
    }
    if (val !== this._saved) {
        this._saved = val;
    }
    this.updateValue(val);
};

const Block = require('./Block').Block;