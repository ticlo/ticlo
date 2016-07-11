'use strict';

const BlockBinding = require('./BlockBinding').BlockBinding;
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


