module bzflow {

    export class Add extends BaseLogicN {
        constructor(block: Block) {
            super(block);
        }

        run(val: any): any {
            let size = this._size._value;
            if (size > 0) {
                let sum = 0;
                for (let i = 0; i < size; ++i) {
                    let val = this._block.getProp('>' + i)._value;
                    if (val === null) {
                        this._out.updateValue(null);
                        return;
                    }
                    sum += Number(val);
                }
                this._out.updateValue(sum);
            } else {
                this._out.updateValue(null);
            }
        };
    }
    Types.add('add', Add);
}
