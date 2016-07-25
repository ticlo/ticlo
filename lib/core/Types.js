'use strict';

const Type = require('./Type').Type;

const Types = {};
module.exports.Types = Types;

/** @type {Object<string, Type>} */
const _types = {};

let _typesFinalized = false;

/**
 *
 * @param {string} name
 * @param {function(new:Logic, Block)} Class
 */
Types.add = function (name, Class) {
    let type = _types[name];

    if (!type) {
        type = new Type(name);
        _types[name] = type;
    }
    type.update(Class);
};

/**
 * @param {string} name
 * @param {Block} block
 * @return {RefListRef<Block>}
 */
Types.listen = function (name, block) {
    let type = _types[name];

    if (!type) {
        type = new Type(name);
        _types[name] = type;
    } else if (type._Class) {
        block.updateLogic(type._Class);
    }
    return type.add(block);
};