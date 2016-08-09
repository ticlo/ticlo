'use strict';

const RefList = require('../util/RefList').RefList;
const RefListRef = RefList.RefListRef;
const IDispatch = require("./Interface").IDispatch;
const IListen = require("./Interface").IListen;

/**
 * @constructor
 * @implements {IDispatch}
 * @implements {IListen}
 * @param {Block} block
 * @param {string} name
 */
function BlockProperty(block, name) {
    /** @type {Block} */
    this._block = block;

    /** @type {string} */
    this._name = name;

    /** @type {RefList<IListen>} */
    this._listeners = null;

    this._value = null;

    this._saved = null;

    /** @type {string} */
    this._bindingPath = null;

    /** @type RefListRef<IListen> */
    this._bindingRef = null;

    /** @type {boolean} */
    this._pendingDispatch = false;
}
module.exports.BlockProperty = BlockProperty;


BlockProperty.prototype.updateValue = IDispatch.prototype.updateValue;
BlockProperty.prototype.onDispatch = IDispatch.prototype.onDispatch;
BlockProperty.prototype.dispatch = function () {
    if (this._listeners) {
        this._listeners.forEach(this.onDispatch, this);
    }
    this._pendingDispatch = false;
};

BlockProperty.prototype.listen = function (listener) {
    if (this._listeners == null) {
        this._listeners = new RefList(BlockProperty.prototype.unListen.bind(this));
    }
    this._listeners.addValue(listener);
    listener.onChange(this._value);
};

BlockProperty.prototype.unListen = function (ref) {
    if (this._listeners.isEmpty()) {
        //TODO check destroy
    }
};

BlockProperty.prototype.onChange = function (val) {
    this.updateValue(val);
};

BlockProperty.prototype.setValue = function (val) {
    if (this._bindingRef) {
        this._bindingRef.remove();
        this._bindingPath = null;
        this._bindingRef = null
    }
    if (val !== this._saved) {
        this._saved = val;
    }
    this.updateValue(val);
};

BlockProperty.prototype.getValue = function () {
    return this._value;
};

/**
 *
 * @param {string} path
 */
BlockProperty.prototype.setBinding = function (path) {
    if (path === this._bindingPath) return;

    if (this._bindingRef !== null) {
        this._bindingRef.remove();
    }
    this._saved = null;
    this._bindingPath = path;
    this._pendingDispatch = true;

    if (path !== null) {
        this._bindingRef = this._block.createBinding(path, this);
    } else {
        this._bindingRef = null;
        this.updateValue(null);
    }
    if (this._pendingDispatch) {
        // notify binding changes to links
        this.dispatch();
    }
};


/**
 *
 * @param val
 */
BlockProperty.prototype._load = function (val) {
    this._saved = val;
    this._value = val;
    this.dispatch();
};
