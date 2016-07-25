'use strict';

/**
 * @implements {IDestroyable}
 * @constructor
 * @param {Block} block
 */
function Logic(block) {
    /** @type {Block} */
    this._block = block;

}
module.exports.Logic = Logic;

/**
 *
 * @param {string} name
 * @param val
 * @return {boolean} return true when it needs to be put in queue
 */
Logic.prototype.inputChanged = function (name, val) {
    return true;
};

/** @type {int} */
Logic.prototype.priority = 0;

/**
 *
 */
Logic.prototype.getDescriptor = function () {
    // example
    return {
        'name': 'someType',
        'inputs': [{'name': '>input', 'type': 'number'}],
        'outputs': [{'name': '<output', 'type': 'number'}],
        'attributes': [{'name': '@attribute', 'type': 'number'}],
    };
};


Logic.prototype.run = function () {
    // example

};

Logic.prototype.destroy = function () {
};