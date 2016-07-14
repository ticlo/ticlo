'use strict';

const BlockBinding = require('./BlockBinding').BlockBinding;
const BlockInput = require('./BlockInput').BlockInput;
const BlockOutput = require('./BlockOutput').BlockOutput;
const BlockMeta = require('./BlockMeta').BlockMeta;
const BlockChild = require('./BlockChild').BlockChild;

/**
 * @constructor
 * @param {BlockRoot} root
 * @param {BlockProperty} prop
 */
function Block(root, prop) {

    /** @package {BlockRoot} */
    this._root = root;

    /** @package {BlockProperty} */
    this._prop = prop;

    /** @package {Object<string,BlockProperty>} */
    this._props = {};

    /** @package {Object<string,BlockBinding>} */
    this._bindings = {};
}
module.exports.Block = Block;

/**
 *
 * @param {string} name
 * @return {BlockProperty}
 */
Block.prototype.getProp = function (name) {
    if (this._props.hasOwnProperty(name)) {
        return this._props[name];
    }
    if (name === '') {
        return this._prop;
    }
    let firstChar = name.charCodeAt(0);
    let prop;
    if (firstChar == 62) { // >
        prop = new BlockInput(this, name);
    } else if (firstChar == 60) { // <
        prop = new BlockOutput(this, name);
        let secondChar = name.charCodeAt(1);
        if (secondChar == 60) { // <<
            this._initSysOutput(name, prop);
        }
    } else if (firstChar == 64) { // @
        prop = new BlockMeta(this, name);
    } else {
        prop = new BlockChild(this, name);
    }
    this._props[name] = prop;
    return prop;
};

/**
 *
 * @param {string} path
 * @param {IListen} listener
 * @return {RefListRef<IListen>}
 */
Block.prototype.createBinding = function (path, listener) {
    let pos = path.lastIndexOf('.');
    if (pos < 0) {
        return this.getProp(path).listen(listener);
    }
    if (this._bindings.hasOwnProperty(path)) {
        return this._bindings[path].listen(listener);
    }
    let parentPath = path.substring(0, pos);
    let name = path.substring(pos + 1);

    let binding = new BlockBinding(this, name);
    this._bindings[path] = binding;

    binding._parentRef = this.createBinding(parentPath, binding);

    return binding.listen(listener);
};

/**
 *
 * @param {string} name
 * @param val
 */
Block.prototype.setValue = function (name, val) {
    this.getProp(name).setValue(val);
};

/**
 *
 * @param {string} name
 * @param val
 */
Block.prototype.updateValue = function (name, val) {
    this.getProp(name).updateValue(val);
};

/**
 *
 * @param {string} name
 * @param {string} path
 */
Block.prototype.setBinding = function (name, path) {
    this.getProp(name).setBinding(path);
};

/**
 *
 * @param {string} name
 */
Block.prototype.getValue = function (name) {
    if (this._props.hasOwnProperty(name)) {
        return this._props[name]._value;
    }
    return null;
};

/**
 *
 * @param {string} name
 * @param {BlockOutput} prop
 * @private
 */
Block.prototype._initSysOutput = function (name, prop) {

};

