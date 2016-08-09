'use strict';

const Logic = require('../../core/Logic').Logic;
const Types = require('../../core/Types').Types;

/**
 * @extends {Logic}
 * @constructor
 * @param {Block} block
 */
function Add(block) {
    this._block = block;

    // cache properties

    /** @type {BlockInput} */
    this._input0 = block.getProp('>0');
    /** @type {BlockInput} */
    this._input1 = block.getProp('>1');
    /** @type {BlockOutput} */
    this._out = block.getProp('<out');
}
module.exports.Add = Add;

Add.prototype = Object.create(Logic.prototype);

Add.prototype.priority = 0;

Add.prototype.isPure = true;

Add.prototype.initRun = true;

Add._descriptor = {
    'name': '+',
    'inputs': [{'name': '>0', 'type': 'number'}, {'name': '>1', 'type': 'number'}],
    'outputs': [{'name': '<out', 'type': 'number'}],
};

Add.prototype.getDescriptor = function () {
    return Add._descriptor
};

/**
 *
 * @return {boolean}
 */
Add.prototype.init = function () {
    return this._input0._value != null || this._input1._value != null;
};

Add.prototype.run = function (val) {
    let block = this._block;
    let v0 = this._input0._value;
    let v1 = this._input1._value;
    if (v0 == null || v1 == null) {
        this._out.updateValue(null);
    } else {
        this._out.updateValue(Number(v0) + Number(v1));
    }
};

Add.prototype.destroy = function () {
};

Types.add('+', Add);
