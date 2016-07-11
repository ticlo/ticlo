'use strict';

const LinkedSet = require('../util/RefList').LinkedSet;
const LinkedSetRef = LinkedSet.LinkedSetRef;
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
    /** @type {LinkedSet<IListen>} */
    this._listeners = null;

    /** @type {Block} */
    this._block = block;

    /** @type {string} */
    this._name = name;

    this._value = null;

    this._saved = null;

    /** @type {string} */
    this._bindingPath = null;

    /** @type LinkedSetRef<IListen> */
    this._bindingRef = null;

    /** @type {boolean} */
    this._pendingDispatch = false;

}
module.exports.BlockProperty = BlockProperty;


BlockProperty.prototype.updateValue = IDispatch.prototype.updateValue;
BlockProperty.prototype.onDispatch = IDispatch.prototype.onDispatch;
BlockProperty.prototype.dispatch = function () {
    this._listeners.forEach(this.onDispatch, this);
    this._pendingDispatch = false;
};

BlockProperty.prototype.listen = function (listener) {
    if (this._listeners === null) {
        this._listeners = new LinkedSet(this);
        this._listeners.remove = BlockProperty.prototype.unListen.bind(this);
    }
    this._listeners.add(listener);
    listener.onChange(this._value);
};

BlockProperty.prototype.unListen = function (ref) {
    LinkedSet.prototype.remove.call(this._listeners, ref);
    if (this._listeners !== null && this._listeners.isEmpty()) {
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


