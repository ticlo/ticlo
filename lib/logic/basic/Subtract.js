'use strict';

const Types = require('../../core/Types').Types;
const BaseLogic2 = require('./BaseLogic2').BaseLogic2;

/**
 * @extends {BaseLogic2}
 * @constructor
 * @param {Block} block
 */
function Subtract(block) {
    BaseLogic2.call(this, block);
}
module.exports.Subtract = Subtract;

Subtract.prototype = Object.create(BaseLogic2.prototype);

Subtract.prototype.name = '-';

Subtract.prototype.run = function (val) {
    let v0 = this._input0._value;
    let v1 = this._input1._value;
    if (v0 == null || v1 == null) {
        this._out.updateValue(null);
    } else {
        this._out.updateValue(v0 - v1);
    }
};

Types.add('-', Subtract);
