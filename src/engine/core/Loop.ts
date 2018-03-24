module bzflow {

    /**
     * priority 0: fast block
     */
    const _loopBlocks0: RefList<Block> = new RefList<Block>();

    let _loopBlocks0Current: RefListRef<Block> = _loopBlocks0._head;

    /**
     * priority 1: heavy block
     */
    const _loopBlocks1: RefList<Block> = new RefList<Block>();


    let _loopBlocks1Current: RefListRef<Block> = _loopBlocks0._head;

    /**
     * priority 2: async block
     */
    const _loopBlocks2: RefList<Block> = new RefList<Block>();

    let _loopBlocks2Current: RefListRef<Block> = _loopBlocks0._head;

    let _loopTimeout: number = -1;
    let _loopingPriority: number = 0;


    export class Loop {

        static tick: number = 0;

        static addBlock(block: Block) {
            if (block._logic) {
                let priority = block._logic.priority;
                switch (priority) {
                    case 0:
                        block._loopRef = new RefListRef(_loopBlocks0, block);
                        RefList.insertBefore(block._loopRef, _loopBlocks0Current);
                        block._loopRun = false;
                        _loopingPriority = 0;
                        break;
                    case 1:
                        block._loopRef = new RefListRef(_loopBlocks1, block);
                        RefList.insertBefore(block._loopRef, _loopBlocks1Current);
                        block._loopRun = false;
                        if (_loopingPriority > 1) {
                            _loopingPriority = 1;
                        }
                        break;
                    case 2:
                        block._loopRef = new RefListRef(_loopBlocks2, block);
                        RefList.insertBefore(block._loopRef, _loopBlocks2Current);
                        block._loopRun = false;
                        break;
                }
                if (_loopTimeout < 0) {
                    _loopTimeout = setTimeout(Loop.run, 0);
                }
            }


        };


        static start() {
            if (_loopTimeout < 0) {
                _loopTimeout = setTimeout(Loop.run, 0);
            }
        };

        static runBlock(ref: RefListRef<Block>) {
            let block = ref.value;
            if (block._loopRun) {
                ref.remove();
                block._loopRef = null;
            } else {
                block.run();
            }
        };

        static run() {
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

            Loop.tick++;
        };

    }
}