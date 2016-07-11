'use strict';

/**
 * @constructor
 * @template ValueType
 * @param {RefList<ValueType>} list
 * @param {ValueType} val
 */
function RefListRef(list, val) {
    /** @package {RefList<ValueType>} */
    this._list = list;

    /** @public {ValueType} */
    this.value = val;

    /** @package {RefListRef<ValueType>} */
    this._next = null;

    /** @package {RefListRef<ValueType>} */
    this._prev = null;
}

/**
 * @returns {boolean}
 */
RefListRef.prototype.removed = function () {
    return this._list == null;
};

RefListRef.prototype.remove = function () {
    if (this._list != null) {
        this._list.remove(this);
    }
};

/**
 * @constructor
 * @template ValueType
 */
function RefList() {


    /** @package {RefListRef<ValueType>} */
    this._head = new RefListRef(this, null);

    /** @package {RefListRef<ValueType>} */
    this._iter = null;

    /** @package {RefListRef<ValueType>} */
    this._iterEnd = null;

    this._head._prev = this._head;
    this._head._next = this._head;
}

module.exports.RefList = RefList;

RefList.RefListRef = RefListRef;


/**
 * @returns {boolean}
 */
RefList.prototype.isEmpty = function () {
    return this._head._next === this._head;
};

/**
 * @returns {boolean}
 */
RefList.prototype.isNotEmpty = function () {
    return this._head._next !== this._head;
};

/**
 * @param {ValueType} val
 * @returns {RefListRef<ValueType>}
 */
RefList.prototype.add = function (val) {
    let node = new RefListRef(this, val);
    this._add(node);
    return node;
};

/**
 * @param {RefListRef<ValueType>} node
 * @package
 */
RefList.prototype._add = function (node) {
    node._next = this._head;
    node._prev = this._head._prev;
    this._head._prev._next = node;
    this._head._prev = node;
};

/**
 * @param {RefListRef<ValueType>} node
 * @package
 */
RefList.prototype.remove = function (node) {
    if (node._list !== this) {
        return;
    }
    if (node === this._iter) {
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iter = this._iter._next;
        }
    } else if (node === this._iterEnd) {
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iterEnd = this._iterEnd._prev;
        }
    }
    node._next._prev = node._prev;
    node._prev._next = node._next;
    node._list = null;
};

/**
 * @param {function(ValueType)} callback
 * @param caller
 */
RefList.prototype.forEach = function (callback, caller) {
    if (this._iter != null) throw 'Concurrent RefList Iteration';
    if (this._head._next == this._head) {
        return;
    }
    this._iter = this._head._next;
    this._iterEnd = this._head._prev;

    while (this._iter) {
        let current = this._iter;
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iter = this._iter._next;
        }
        callback.call(caller, current.value);
    }
};

/**
 * @param {function(RefListRef<ValueType>)} callback
 * @param caller
 */
RefList.prototype.forEachNode = function (callback, caller) {
    if (this._iter != null) throw 'Concurrent RefList Iteration';
    if (this._head._next == this._head) {
        return;
    }
    this._iter = this._head._next;
    this._iterEnd = this._head._prev;

    while (this._iter) {
        let current = this._iter;
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iter = this._iter._next;
        }
        callback.call(caller, current);
    }
};

/** fast way to remove node, because its prev and next no longer need to be maintained */
function _clearNode(node) {
    node._list = null;
}

RefList.prototype.clear = function () {
    if (this._iter != null)
        throw 'clear() Ignored during RefList Iteration';

    this.forEachNode(_clearNode);
    this._head._prev = this._head;
    this._head._next = this._head;
};


