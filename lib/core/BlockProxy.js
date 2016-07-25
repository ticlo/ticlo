'use strict';

const BlockProxy = {};
module.exports.BlockProxy = BlockProxy;

/**
 *
 * @param {Block} block
 * @param {string} field
 */
BlockProxy.get = function (block, field) {
    let prop = block._props[field];
    if (prop) {
        return prop._value;
    }
    return null;
};

/**
 *
 * @param {Block} block
 * @param {string} field
 * @param value
 */
BlockProxy.set = function (block, field, value) {
    let prop = block.getProp(field);
    prop.updateValue(value);
};
