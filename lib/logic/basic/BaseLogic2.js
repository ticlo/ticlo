'use strict';

const Logic = require('../../core/Logic').Logic;
const Types = require('../../core/Types').Types;

/**
 * @extends {Logic}
 * @constructor
 * @param {Block} block
 */
function BaseLogic2(block) {
    this._block = block;

    // cache properties

    /** @type {BlockInput} */
    this._input0 = block.getProp('>0');
    /** @type {BlockInput} */
    this._input1 = block.getProp('>1');
    /** @type {BlockOutput} */
    this._out = block.getProp('<out');
}
module.exports.BaseLogic2 = BaseLogic2;

BaseLogic2.prototype = Object.create(Logic.prototype);

BaseLogic2.prototype.priority = 0;

BaseLogic2._descriptor = {
    'name': '+',
    'inputs': [{'name': '>0', 'type': 'number'}, {'name': '>1', 'type': 'number'}],
    'outputs': [{'name': '<out', 'type': 'number'}],
};

BaseLogic2.prototype.getDescriptor = function () {
    return BaseLogic2._descriptor
};

/**
 *
 * @return {boolean}
 */
BaseLogic2.prototype.checkInitRun = function () {
    return this._input0._value != null || this._input1._value != null;
};

BaseLogic2.prototype.inputChanged = function (input, val) {
    return true;
};


BaseLogic2.prototype.destroy = function () {
};

