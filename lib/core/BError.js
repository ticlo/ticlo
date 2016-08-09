'use strict';

/**
 * @constructor
 * @param {string} type
 * @param {string} message
 */
function BError(type, message) {
    this.type = type;
    this.message = message;
}
module.exports.BError = BError;
