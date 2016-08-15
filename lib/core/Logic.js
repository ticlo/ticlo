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


Logic.prototype.name = '';

/** @type {int} */
Logic.prototype.priority = 0;

/**
 * whether the logic should be run right after it's created
 * @type {boolean}
 */
Logic.prototype.initRun = false;

Logic.prototype._descriptor = {
    'inputs': [{'name': '>input', 'type': 'string', 'editor': 'enum[a,b,c]'}],
    'outputs': [{'name': '<output', 'type': 'number'}],
    'attributes': [{'name': '@attribute', 'type': 'number'}],
};

/**
 *
 */
Logic.prototype.getDescriptor = function () {
    // example
    return Logic.prototype._descriptor;
};

/**
 *
 * @param {BlockInput} input
 * @param val
 * @return {boolean} return true when it needs to be put in queue
 */
Logic.prototype.inputChanged = function (input, val) {
    return false;
};

/**
 *
 * @param val
 */
Logic.prototype.run = function (val) {
    // example
};

/**
 *
 * @return {boolean}
 */
Logic.prototype.checkInitRun = function () {
    return false;
};

/**
 *
 * @param {boolean} loading
 */
Logic.prototype.checkInitTrigger = function (loading) {

};

Logic.prototype.destroy = function () {
};
