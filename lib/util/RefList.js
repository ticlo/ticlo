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
 * @param {function(RefListRef<ValueType>)} removeCallback
 */
function RefList(removeCallback = null) {

    this._owner = null;

    /** @private {function(RefListRef<ValueType>)} */
    this._removeCallback = removeCallback;

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
RefList.prototype.addValue = function (val) {
    let ref = new RefListRef(this, val);
    this.insertBefore(ref, this._head);
    return ref;
};

/**
 * @param {RefListRef<ValueType>} ref
 * @package
 */
RefList.prototype.add = function (ref) {
    ref._next = this._head;
    ref._prev = this._head._prev;
    this._head._prev._next = ref;
    this._head._prev = ref;
};

RefList.prototype.addFirst = function (ref) {
    ref._next = this._head.next;
    ref._prev = this._head;
    this._head._next._prev = ref;
    this._head._next = ref;
};

/**
 * @param {RefListRef<ValueType>} ref
 * @param {RefListRef<ValueType>} base
 * @package
 */
RefList.prototype.insertBefore = function (ref, base) {
    ref._next = base;
    ref._prev = base._prev;
    base._prev._next = ref;
    base._prev = ref;
};


/**
 * @param {RefListRef<ValueType>} ref
 * @package
 */
RefList.prototype.remove = function (ref) {
    if (ref._list !== this) {
        return;
    }
    if (ref === this._iter) {
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iter = this._iter._next;
        }
    } else if (ref === this._iterEnd) {
        if (this._iter === this._iterEnd) {
            this._iter = null;
            this._iterEnd = null;
        } else {
            this._iterEnd = this._iterEnd._prev;
        }
    }
    ref._next._prev = ref._prev;
    ref._prev._next = ref._next;
    ref._list = null;

    if (this._removeCallback != null) {
        this._removeCallback(ref);
    }
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
RefList.prototype.forEachRef = function (callback, caller) {
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

/** fast way to remove ref, because its prev and next no longer need to be maintained */
function _clearRef(ref) {
    ref._list = null;
}

RefList.prototype.clear = function () {
    if (this._iter != null)
        throw 'clear() Ignored during RefList Iteration';

    this.forEachRef(_clearRef);
    this._head._prev = this._head;
    this._head._next = this._head;
};


