module bzflow {

    export class Multiply extends BaseLogicN {
        constructor(block: Block) {
            super(block);
        }

        run(val: any): any {
            let size = this._size._value;
            if (size > 0) {
                let product = 1;
                for (let i = 0; i < size; ++i) {
                    let val = this._block.getProp('>' + i)._value;
                    if (val === null) {
                        this._out.updateValue(null);
                        return;
                    }
                    product *= Number(val);
                }
                this._out.updateValue(product);
            } else {
                this._out.updateValue(null);
            }
        };
    }
    Types.add('multiply', Multiply);
}