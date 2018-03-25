module bzflow {

    const SCRIPT_ERROR: string = 'scriptError';

    export class JsLogic extends Logic {

        _script: BlockInput;
        _head: BlockInput;

        _compiledFunction: Function;
        _runFunction: Function;

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
                    try {
                        this._compiledFunction = new Function(this._script._value);
                    } catch (err) {
                        return new TcError(SCRIPT_ERROR, err.toString());
                    }
                    let rslt: any;
                    try {
                        rslt = this._compiledFunction.apply(this._block.getProxy());
                    } catch (err) {
                        this._compiledFunction = null;
                        return new TcError(SCRIPT_ERROR, err.toString());
                    }
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
                let rslt: any;
                try {
                    rslt = this._runFunction.apply(this._block.getProxy());
                } catch (err) {
                    return new TcError(SCRIPT_ERROR, err.toString());
                }
                return rslt;
            }
        };
    }

    JsLogic.prototype.priority = 2;

    Types.add('js', JsLogic);
}
