module breezeflow {

    export class JsLogic extends Logic {

        _script: BlockInput;
        _head: BlockInput;

        _compiledFunction:Function;
        _runFunction:Function;

        constructor(block: Block) {
            super(block);
            // cache properties
            this._script = block.getProp('>script') as BlockInput;

        }

        inputChanged(input: BlockInput, val: any): boolean {
            if (input == this._script) {
                this._compiledFunction = null;
                this._runFunction = null;
            }
            return true;
        };

        run(val: any): any {
            if (!this._compiledFunction) {
                if (typeof this._script._value == 'string') {
                    this._compiledFunction = new Function(this._script._value);
                    let rslt = this._compiledFunction.apply(this._block.getProxy());
                    if (typeof rslt == 'function') {
                        // let the function run again
                        this._runFunction = rslt;
                    } else {
                        this._runFunction = this._compiledFunction;
                        return rslt;
                    }
                } else {
                    return null;
                }
            }
            if (this._runFunction) {
                return this._runFunction.apply(this._block.getProxy());
            }
        };
    }

    JsLogic.prototype.priority = 2;

    Types.add('js', JsLogic);
}
