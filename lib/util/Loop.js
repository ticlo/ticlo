'use strict';

const RefList = require('./RefList').RefList;

const Loop = {};
module.exports.Loop = Loop;

/**
 * priority 0: fast block
 * @type {RefList<Block>}
 */
const _loopBlocks0 = new RefList();

/**
 * priority 1: heavy block
 * @type {RefList<Block>}
 */
const _loopBlocks1 = new RefList();

/**
 * priority 2: async block
 * @type {RefList<Block>}
 */
const _loopBlocks2 = new RefList();

/**
 * @type {Array<RefList<Block>>}
 */
const _loopBlocks = [_loopBlocks0, _loopBlocks1, _loopBlocks2];

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
                block._loopRef = _loopBlocks0.add(block);
                _loopingPriority = 0;
                break;
            case 1:
                block._loopRef = _loopBlocks1.add(block);
                if (_loopingPriority > 1) {
                    _loopingPriority = 1;
                }
                break;
            case 2:
                block._loopRef = _loopBlocks2.add(block);
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

Loop.run = function () {
    _loopTimeout = -1;

    let head0 = _loopBlocks0._head;
    let head1 = _loopBlocks1._head;
    let head2 = _loopBlocks2._head;

    whileLoop:while (true) {
        while(head0._next != head0) {

        }

        _loopingPriority = 1;
        while(head1._next !== head1) {

            if (_loopingPriority === 0) {
                continue whileLoop;
            }
        }

        _loopingPriority = 2;
        while(head2._next !== head2) {

            if (_loopingPriority !== 2) {
                continue whileLoop;
            }
        }
        break;
    }
};