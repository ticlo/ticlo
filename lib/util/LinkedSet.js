'use strict';

/**
 * @constructor
 * @template OwnerType, ValueType
 * @param {LinkedSet<OwnerType, ValueType>} list
 * @param {ValueType} val
 */
function LinkedSetNode(list, val) {
    /** @package {LinkedSet<OwnerType, ValueType>} */
    this._list = list;

    /** @public {ValueType} */
    this.value = val;

    /** @package {LinkedSetNode<OwnerType, ValueType>} */
    this._next = null;

    /** @package {LinkedSetNode<OwnerType, ValueType>} */
    this._prev = null;
}

/**
 * @returns {OwnerType}
 */
LinkedSetNode.prototype.owner = function () {
    return this._list.owner();
};

/**
 * @returns {boolean}
 */
LinkedSetNode.prototype.removed = function () {
    return this._list == null;
};

LinkedSetNode.prototype.remove = function () {
    if (this._list != null) {
        this._list._remove(this);
    }
};

/**
 * @constructor
 * @template OwnerType, ValueType
 * @param {OwnerType} owner
 */
function LinkedSet(owner) {

    /** @package {OwnerType} */
    this._owner = owner;

    /** @package {LinkedSetNode<OwnerType, ValueType>} */
    this._head = new LinkedSetNode(this, null);

    /** @package {LinkedSetNode<OwnerType, ValueType>} */
    this._iterator = null;

    this._head._prev = this._head;
    this._head._next = this._head;
}
/**
 * @returns {OwnerType}
 */
LinkedSet.prototype.owner = function () {
    return this._owner;
};

/**
 * @returns {boolean}
 */
LinkedSet.prototype.isEmpty = function () {
    return this._head._next === this._head;
};

/**
 * @returns {boolean}
 */
LinkedSet.prototype.isNotEmpty = function () {
    return this._head._next !== this._head;
};

/**
 * @param {ValueType} val
 * @returns {LinkedSetNode<OwnerType, ValueType>}
 */
LinkedSet.prototype.add = function (val) {
    let node = new LinkedSetNode(this, val);
    this._add(node);
    return node;
};

/**
 * @param {LinkedSetNode<OwnerType, ValueType>} node
 * @package
 */
LinkedSet.prototype._add = function (node) {
    node._next = this._head;
    node._prev = this._head._prev;
    this._head._prev._next = node;
    this._head._prev = node;
};

/**
 * @param {LinkedSetNode<OwnerType, ValueType>} node
 * @package
 */
LinkedSet.prototype._remove = function (node) {
    if (node == this._iterator) {
        this._iterator = this._iterator._next;
    }
    node._next._prev = node._next;
    node._prev._next = node._prev;
    node._list = null;
};

/**
 * @param {function(ValueType)} callback
 */
LinkedSet.prototype.forEach = function (callback) {
    if (this._iterator != null) throw 'Concurrent LinkedSet Iteration';

    this._iterator = this._head._next;
    while (this._iterator != this._head) {
        let current = this._iterator;
        this._iterator = this._iterator._next;
        callback(current.value);
    }
    this._iterator = null;
};

/**
 * @param {function(LinkedSetNode<OwnerType, ValueType>)} callback
 */
LinkedSet.prototype.forEachNode = function (callback) {
    if (this._iterator != null) throw 'Concurrent LinkedSet Iteration';

    this._iterator = this._head._next;
    while (this._iterator != this._head) {
        let current = this._iterator;
        this._iterator = this._iterator._next;
        callback(current);
    }
    this._iterator = null;
};

/** fast way to remove node, because its prev and next no longer need to be maintained */
function _clearNode(node) {
    node._list = null;
}

LinkedSet.prototype.clear = function () {
    if (this._iterator != null)
        throw 'clear() Ignored during LinkedSet Iteration';

    this.forEachNode(_clearNode);
    this._head._prev = this._head;
    this._head._next = this._head;
};

module.exports = LinkedSet;
