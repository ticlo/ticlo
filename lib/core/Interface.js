'use strict';

const RefList = require('../util/RefList').RefList;

/**
 * @interface
 */
function IDestroyable() {
}
module.exports.IDestroyable = IDestroyable;

IDestroyable.prototype.destroy = function () {
};

/**
 * @interface
 */
function IDispatch() {
    /** @type {RefList<IListen>} */
    this._listeners = null;

    /** @type {Block} */
    this._block = null;
    this._value = null;
}
module.exports.IDispatch = IDispatch;

/**
 * @param {IListen} listener
 * @return {RefListRef.<IListen>}
 */
IDispatch.prototype.listen = function (listener) {
    if (this._listeners === null) {
        this._listeners = new RefList(this);
    }
    let ref = this._listeners.add(listener);
    listener.onChange(this._value);
    return ref;
};

/**
 *
 * @param {RefListRef<IListen>} ref
 */
IDispatch.prototype.unListen = function (ref) {
    ref.remove();
    if (this._listeners !== null && this._listeners.isEmpty()) {
        this._listeners = null;
    }
};


/**
 *
 * @param val
 * @return {boolean}
 */
IDispatch.prototype.updateValue = function (val) {
    if (this._value === val) {
        return false;
    }
    this._value = val;
    this.dispatch();
    return true;
};

IDispatch.prototype.dispatch = function () {
    this._listeners.forEach(this.onDispatch, this);
};
/**
 *
 * @param {IListen} listener
 */
IDispatch.prototype.onDispatch = function (listener) {
    listener.onChange(this._value);
};


/**
 * @interface
 */
function IListen() {
}
module.exports.IListen = IListen;

/**
 * @package
 */
IListen.prototype.onChange = function (val) {

};