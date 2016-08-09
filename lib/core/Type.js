'use strict';

const RefList = require('../util/RefList').RefList;

/**
 * @constructor
 * @param {string} name
 */
function Type(name) {
    /** @type {function(new:Logic, Block)} */
    this._Class = null;
    /** @private {boolean} whether type can be changed at runtime */
    this._name = name;

    /** @type {RefList<Block>} */
    this._blocks = new RefList();
    this._blocks._owner = this;

    this._boundUpdateBlockLogic = Type.prototype._updateBlockLogic.bind(this);

    /** @type {boolean} */
    this._isStatic = !name.includes('::');
}
module.exports.Type = Type;


/**
 *
 * @param {Block} block
 * @private
 */
Type.prototype._updateBlockLogic = function (block) {
    block.updateLogic(this._Class);
};

/**
 *
 * @param {function(new:Logic, Block)} Class
 */
Type.prototype.update = function (Class) {
    this._Class = Class;
    this._blocks.forEach(this._boundUpdateBlockLogic);
};

/**
 *
 * @param {Block} block
 * @return {RefListRef<Block>}
 */
Type.prototype.addValue = function (block) {
    block.updateLogic(this._Class);
    if (this._isStatic && this._Class) {
        return null;
    } else {
        return this._blocks.addValue(block);
    }
};