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
}
module.exports.Add = Add;

Add.prototype = Object.create(Logic.prototype);


Add.prototype.getDescriptor
    = function () {
    // example
    return {
        'name': '+',
        'inputs': [{'name': '>0', 'type': 'number'}, {'name': '>1', 'type': 'number'}],
        'outputs': [{'name': '<output', 'type': 'number'}],
    };
};

Logic.prototype.run = function () {
    let v0 = this.getValue('>0');
    let v1 = this.getValue('>1');
    if (v0 === null || v1 === null) {
        this.updateValue('>output', null);
    } else {
        this.updateValue('>output', Number(v0) + Number(v1));
    }
};

Logic.prototype.destroy = function () {
};

Types.add('+', Add);
