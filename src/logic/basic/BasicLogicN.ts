module breezeflow {

    export class BaseLogicN extends Logic {
        _size: BlockInput;
        _out: BlockOutput;

        constructor(block: Block) {
            super(block);
            this._size = block.getProp('>size') as BlockInput;
            this._out = block.getProp('<out');
        }

        static _descriptor: LogicDesc = {
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

        getDescriptor(): LogicDesc {
            return BaseLogicN._descriptor
        };

        checkInitRun(): boolean {
            return this._size._value > 0;
        };
    }
    BaseLogicN.prototype.priority = 0;
}
