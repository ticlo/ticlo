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
 * when isPure == true, same inputs have same outputs, logic keeps no extra state
 * @type {boolean}
 */
Logic.prototype.isPure = true;

/**
 * whether the logic should be run right after it's created
 * @type {boolean}
 */
Logic.prototype.initRun = false;

Logic._descriptor = {
    'name': 'someType',
    'inputs': [{'name': '>input', 'type': 'string', 'editor': 'enum[a,b,c]'}],
    'outputs': [{'name': '<output', 'type': 'number'}],
    'attributes': [{'name': '@attribute', 'type': 'number'}],
    'type': 'normal', // normal, async, stream
};
/**
 *
 */
Logic.prototype.getDescriptor = function () {
    // example
    return Logic._descriptor;
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
Logic.prototype.init = function () {
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
