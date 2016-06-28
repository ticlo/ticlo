'use strict';

/**
 * @constructor
 * @param {BlockRoot} root
 * @param {string} name
 */
function Block(root, name){

    /** @type {BlockRoot} */
    this._root = root;

    /** @type {string} */
    this._name = name;

    /** @type {Map<string,BlockProperty>} */
    this._props = new Map();
}


module.exports = Block;

