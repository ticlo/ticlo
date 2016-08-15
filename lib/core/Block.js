'use strict';


/**
 * @constructor
 * @implements {IDestroyable}
 * @param {BlockRoot} root
 * @param {BlockProperty} prop
 */
function Block(root, prop) {

    /** @type {BlockRoot} */
    this._root = root;

    /** @type {BlockProperty} */
    this._prop = prop;

    /** @type {number} */
    this._gen = Loop.tick;

    /** @type {string} */
    this._mode = 'auto';

    /** @type {Object<string,BlockProperty>} */
    this._props = {};

    /** @type {Object<string,BlockBinding>} */
    this._bindings = {};

    /** @type {Logic} */
    this._logic = null;

    /** @type {RefListRef<Block>} */
    this._typeRef = null;

    /** @type {RefListRef<Block>} */
    this._loopRef = null;
    /** @type {boolean} */
    this._loopRun = null;

    /** @type {BlockOutput} */
    this._pOut = this.getProp('<<');
}
module.exports.Block = Block;

/**
 *
 * @param {string} field
 * @return {BlockProperty}
 */
Block.prototype.getProp = function (field) {
    if (this._props.hasOwnProperty(field)) {
        return this._props[field];
    }
    if (field === '') {
        return this._prop;
    }
    let firstChar = field.charCodeAt(0);
    let prop;
    if (firstChar == 62) { // >
        prop = new BlockInput(this, field);
    } else if (firstChar == 60) { // <
        prop = new BlockOutput(this, field);
        let secondChar = field.charCodeAt(1);
        if (secondChar == 60) { // <<
            this._initSysOutput(field, prop);
        }
    } else if (firstChar == 64) { // @
        prop = new BlockMeta(this, field);
    } else {
        prop = new BlockChild(this, field);
    }
    this._props[field] = prop;
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
    let field = path.substring(pos + 1);

    let binding = new BlockBinding(this, field);
    this._bindings[path] = binding;

    binding._parentRef = this.createBinding(parentPath, binding);

    return binding.listen(listener);
};


/**
 *
 * @param {Object} map
 */
Block.prototype.load = function (map) {
    this._load(map);
};

/**
 *
 * @param {Object} map
 */
Block.prototype._load = function (map) {
    let pendingType;
    for (let key in map) {
        if (key !== '>>type') {
            if (key.charCodeAt(0) === 126) { // ~ for binding
                let val = map[key];
                if (typeof val === 'string') {
                    let name = key.substring(1);
                    this.setBinding(name, val);
                }
            } else {
                this.getProp('key')._load(map[key]);
            }
        } else {
            pendingType = map['>>type'];
        }
    }
    if (pendingType) {
        this.setValue('>>type', pendingType);
    }
};

/**
 *
 * @param {Object} map
 */
Block.prototype.merge = function (map) {

};

/**
 *
 * @param {string} field
 * @param val
 */
Block.prototype.setValue = function (field, val) {
    this.getProp(field).setValue(val);
};

/**
 *
 * @param {string} field
 * @param val
 */
Block.prototype.updateValue = function (field, val) {
    this.getProp(field).updateValue(val);
};

/**
 *
 * @param {string} field
 * @param {string} path
 */
Block.prototype.setBinding = function (field, path) {
    this.getProp(field).setBinding(path);
};

/**
 *
 * @param {string} field
 */
Block.prototype.getValue = function (field) {
    if (this._props.hasOwnProperty(field)) {
        return this._props[field]._value;
    }
    return null;
};

/**
 *
 * @param {string} field
 * @return {Block}
 */
Block.prototype.createBlock = function (field) {
    let firstChar = field.charCodeAt(0);
    if (firstChar < 60 || firstChar > 64) {
        let prop = this.getProp(field);
        if (prop._value == null || prop._value._prop !== prop) {
            let block = new Block(this._root, prop);
            prop.setValue(block);
            return block;
        }
    }
    return null;
};

/**
 *
 * @param {BlockInput} input
 * @param val
 */
Block.prototype.inputChanged = function (input, val) {
    if (input._isSysInput) {
        let inputName = input._name;
        switch (inputName) {
            case '>>':
                this.onRun(val);
                break;
            case '>>type':
                this.typeChanged(val);
                break;
            case '>>trigger':
                this.onTrigger(val);
                break;
            case '>>mode': // auto, delayed, trigger, disabled
                this.onMode(val);
                break;
        }
    } else if (this._logic) {
        if (this._logic.inputChanged(input, val)) {
            if (this._mode !== 'manual') {
                this.trigger();
            }
        }
    }
};

Block.prototype.run = function () {
    this._loopRun = true;
    let out = this._logic.run(null);
    if (out == null) {
        out = new BEvent();
    }
    this._pOut.updateValue(out);
};

Block.prototype.trigger = function () {
    if (!this._loopRef) {
        switch (this._mode) {
            case 'disabled':
                return;
            case 'delayed':
                if (this._gen !== Loop.tick) {
                    return;
                }
        }
        Loop.addBlock(this);
    }
};

/**
 *
 * @param  mode
 */
Block.prototype.onMode = function (mode) {
    switch (mode) {
        case 'trigger':
        case 'delayed':
            this._mode = mode;
            break;
        case 'disabled':
        case 'false':
        case false:
            this._mode = 'disabled';
            break;
        default:
            this._mode = 'auto';
    }
};

/**
 *
 * @param val
 */
Block.prototype.onRun = function (val) {
    if (this._logic && this._mode !== 'disabled' && BEvent.isValid(val)) {
        this._loopRun = true;
        let out = this._logic.run(val);
        if (out == null) {
            out = val;
        }
        this._pOut.updateValue(out);
    }
};

/**
 *
 * @param val
 */
Block.prototype.onTrigger = function (val) {
    if (this._logic &&  BEvent.isValid(val)) {
        this.trigger();
    }
};

/**
 *
 * @param {string} typeName
 */
Block.prototype.typeChanged = function (typeName) {
    if (this._typeRef) {
        this._typeRef.remove();
    }
    if (typeof(typeName) === 'string') {
        this._typeRef = Types.listen(typeName, this);
    } else {
        this._typeRef = null;
        this.updateLogic(null);
    }
};

/**
 * @param {function(new:Logic, Block)} Class
 */
Block.prototype.updateLogic = function (Class) {
    if (this._logic) {
        this._logic.destroy();
    }
    if (Class) {
        this._logic = new Class(this);
        if (this._logic.checkInitRun()) {
            this.trigger();
        }
    } else {
        this._logic = null;
    }
};


/**
 *
 * @param {string} field
 * @param {BlockOutput} prop
 * @private
 */
Block.prototype._initSysOutput = function (field, prop) {
    // TODO
};

Block.prototype.destroy = function () {
    //TODO
};

const Types = require('./Types').Types;
const BlockBinding = require('./BlockBinding').BlockBinding;
const BlockInput = require('./BlockInput').BlockInput;
const BlockOutput = require('./BlockOutput').BlockOutput;
const BlockMeta = require('./BlockMeta').BlockMeta;
const BlockChild = require('./BlockChild').BlockChild;
const Loop = require("./Loop").Loop;
const BEvent = require("./BEvent").BEvent;