'use strict';

const RefList = require('./../util/RefList').RefList;
const RefListRef = RefList.RefListRef;

const Loop = {};
module.exports.Loop = Loop;

/** @type {number} */
Loop.tick = 0;

/**
 * priority 0: fast block
 * @type {RefList<Block>}
 */
const _loopBlocks0 = new RefList();

/**
 * @type {RefListRef<Block>}
 */
let _loopBlocks0Current = _loopBlocks0._head;

/**
 * priority 1: heavy block
 * @type {RefList<Block>}
 */
const _loopBlocks1 = new RefList();

/**
 * @type {RefListRef<Block>}
 */
let _loopBlocks1Current = _loopBlocks0._head;

/**
 * priority 2: async block
 * @type {RefList<Block>}
 */
const _loopBlocks2 = new RefList();

/**
 * @type {RefListRef<Block>}
 */
let _loopBlocks2Current = _loopBlocks0._head;

let _loopTimeout = -1;
let _loopingPriority = 0;

/**
 *
 * @param {Block} block
 */
Loop.addBlock = function (block) {
    if (block._logic) {
        let priority = block._logic.priority;
        switch (priority) {
            case 0:
                block._loopRef = _loopBlocks0.insertBefore(new RefListRef(_loopBlocks0, block), _loopBlocks0Current);
                block._loopRun = false;
                _loopingPriority = 0;
                break;
            case 1:
                block._loopRef = _loopBlocks1.insertBefore(new RefListRef(_loopBlocks1, block), _loopBlocks1Current);
                block._loopRun = false;
                if (_loopingPriority > 1) {
                    _loopingPriority = 1;
                }
                break;
            case 2:
                block._loopRef = _loopBlocks2.insertBefore(new RefListRef(_loopBlocks2, block), _loopBlocks2Current);
                block._loopRun = false;
                break;
        }
        if (_loopTimeout < 0) {
            _loopTimeout = setTimeout(Loop.run, 0);
        }
    }


};


Loop.start = function () {
    if (_loopTimeout < 0) {
        _loopTimeout = setTimeout(Loop.run, 0);
    }
};

/**
 * @param {RefListRef<Block>} ref
 */
Loop.runBlock = function(ref) {
    /** @type {Block} */
    let block = ref.value;
    if (block._loopRun) {
        ref.remove();
    } else {
        block.run();
    }
};

Loop.run = function () {
    _loopTimeout = -1;

    let head0 = _loopBlocks0._head;
    let head1 = _loopBlocks1._head;
    let head2 = _loopBlocks2._head;

    whileLoop:while (true) {
        while (true) {
            _loopBlocks0Current = head0._next;
            if (_loopBlocks0Current === head0) {
                break;
            } else {
                Loop.runBlock(_loopBlocks0Current);
            }
        }

        _loopingPriority = 1;
        while (true) {
            _loopBlocks1Current = head1._next;
            if (_loopBlocks1Current === head1) {
                break;
            } else {
                Loop.runBlock(_loopBlocks1Current);
            }
            if (_loopingPriority === 0) {
                _loopBlocks1Current = head1._next;
                continue whileLoop;
            }
        }

        _loopingPriority = 2;
        while (true) {
            _loopBlocks2Current = head2._next;
            if (_loopBlocks2Current === head2) {
                break;
            } else {
                Loop.runBlock(_loopBlocks2Current);
            }
            if (_loopingPriority !== 2) {
                _loopBlocks2Current = head2._next;
                continue whileLoop;
            }
        }
        break;
    }

    Loop.tick ++;
};