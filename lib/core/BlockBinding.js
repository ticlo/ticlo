'use strict';

const RefList = require('../util/RefList').RefList;
const RefListRef = RefList.RefListRef;
const IDispatch = require("./Interface").IDispatch;
const IListen = require("./Interface").IListen;

/**
 * @constructor
 * @extends {RefListRef<IListen>}
 * @param {RefList<IListen>} list
 * @param {IListen} val
 */
function RefListBindingWrapper(list, val) {
    /** @package {RefList<IListen>} */
    this._list = list;

    /** @public {IListen} */
    this.value = val;

    /** @package {RefListRef<IListen>} */
    this._next = null;

    /** @package {RefListRef<IListen>} */
    this._prev = null;

    /** @package {RefListRef<IListen>} */
    this._parkedRef = null;
}

RefListBindingWrapper.prototype.owner = RefListRef.prototype.owner;
RefListBindingWrapper.prototype.removed = RefListRef.prototype.removed;
RefListBindingWrapper.prototype.remove = RefListRef.prototype.remove;

/**
 *
 * @param {RefListBindingWrapper} wrapper
 */
RefListBindingWrapper.destroy = function (wrapper) {
    if (wrapper._parkedRef) {
        wrapper._parkedRef.remove();
    }
};

/**
 * @constructor
 * @implements {IDispatch}
 * @implements {IListen}
 * @param {Block} block
 * @param {string} name
 */
function BlockBinding(block, name) {
    /** @type {RefList<IListen>} */
    this._listeners = null;

    /** @type {Block} */
    this._block = block;

    /** @type {string} */
    this._name = name;

    this._value = null;

    this._source = null;

    /** @type {RefListRef<IListen>} */
    this._parentRef = null;

    /** @type {BlockProperty} */
    this._prop = null;

    this._boundPropChanged = BlockBinding.prototype.boundPropChanged.bind(this);
}
module.exports.BlockBinding = BlockBinding;

BlockBinding.prototype.unListen = IDispatch.prototype.unListen;
BlockBinding.prototype.updateValue = IDispatch.prototype.updateValue;
BlockBinding.prototype.onDispatch = IDispatch.prototype.onDispatch;
BlockBinding.prototype.dispatch = IDispatch.prototype.dispatch;

/**
 * @this {RefList}
 * @param {IListen} val
 * @returns {RefListRef<IListen>}
 */
function _addLinkSetNodeWrapper(val) {
    let wrapper = new RefListBindingWrapper(this, val);
    this._add(wrapper);
    return wrapper;
}

/**
 * @param {RefListBindingWrapper} wrapper
 */
BlockBinding.prototype.unListen = function (wrapper) {
    if (wrapper._parkedRef) {
        wrapper._parkedRef.remove();
    }
    if (this._listeners.isEmpty()) {
        this._listeners = null;
        //TODO destroy
    }
};

BlockBinding.prototype.listen = function (listener) {
    if (this._listeners === null) {
        this._listeners = new RefList(BlockBinding.prototype.unListen.bind(this));
        this._listeners.add = _addLinkSetNodeWrapper;
    }
    let wrapper = /** @type {RefListBindingWrapper} */ this._listeners.add(listener);

    if (this._prop != null) {
        wrapper._parkedRef = this._prop.listen(listener);
    } else {
        listener.onChange(this._value);
    }
};


BlockBinding.prototype.onChange = function (val) {
    if (this._source === val) {
        return;
    }
    this._source = val;
    if (val instanceof Block) {
        this._propChanged(val.getProp(this._name));
    } else {
        let bindingChanged = this._propChanged(null);
        let valueUpdated;
        if (typeof(val) == 'object' && val.__prototype__ === undefined && val !== null && val.hasOwnProperty(this._name)) {
            // drill down into object children
            valueUpdated = this.updateValue(val[this._name]);
        } else {
            valueUpdated = this.updateValue(null);
        }
        if (bindingChanged && !valueUpdated) {
            // binding changed to null but value was not updated
            // need an extra update on the value
            this.dispatch();
        }
    }
};
/**
 * @param {BlockProperty} prop
 * @return {boolean}
 * @private
 */
BlockBinding.prototype._propChanged = function (prop) {
    if (prop == this._prop) return false;
    this._prop = prop;
    if (this._listeners) {
        this._listeners.forEachNode(this._boundPropChanged);
    }
    return true;
};
/**
 *
 * @param {RefListBindingWrapper} wrapper
 */
BlockBinding.prototype.boundPropChanged = function (wrapper) {
    if (wrapper._parkedRef) {
        wrapper.remove();
    }
    if (this._prop) {
        wrapper._parkedRef = this._prop.listen(wrapper.value);
    } else {
        wrapper._parkedRef = null;
    }
};

BlockBinding.prototype.destroy = function () {
    if (this._listeners) {
        this._listeners.forEach(null, RefListBindingWrapper.destroy);
        this._listeners.clear();
    }
    if (this._parentRef) {
        this._parentRef.remove();
    }
};

const Block = require("./Block").Block;
