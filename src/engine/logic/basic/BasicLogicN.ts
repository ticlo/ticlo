module bzflow {

    export class BaseLogicN extends Logic {
        _size: BlockInput;
        _out: BlockOutput;

        constructor(block: Block) {
            super(block);
            this._size = block.getProp('>size') as BlockInput;
            this._out = block.getProp('<out');
        }

        checkInitRun(): boolean {
            return this._size._value > 0;
        };
    }
    BaseLogicN.prototype.priority = 0;
    BaseLogic2.prototype.descriptor = {
        'inputs': [
            {
                'group': 'input', 'type': 'group', 'size': '>size',
                'fields': [
                    {'name': '>', 'type': 'number'}
                ]
            }
        ],
        'outputs': [
            {'name': '<out', 'type': 'number'}
        ],
    };
}
