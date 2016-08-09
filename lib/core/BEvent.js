'use strict';

/**
 * @constructor
 */
function BEvent() {
    this.tick = Loop.tick;
}
module.exports.BEvent = BEvent;


BEvent.isValid = function (val) {
    if (val == null) {
        return false;
    }
    if (val instanceof BEvent) {
        return val.tick == Loop.tick;
    }
    return true;
};

const Loop = require("./Loop").Loop;