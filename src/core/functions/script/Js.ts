import { Classes } from "../../block/Class";
import { BlockFunction, FunctionData } from "../../block/BlockFunction";
import { BlockIO, BlockProperty } from "../../block/BlockProperty";
import { FunctionResult } from "../../block/Event";

const SCRIPT_ERROR = 'scriptError';

export class JsFunction extends BlockFunction {

  _script: BlockProperty;

  _compiledFunction: Function;
  _runFunction: Function;

  constructor(block: FunctionData) {
    super(block);
    this._script = block.getProperty('script');
  }

  inputChanged(input: BlockIO, val: any): boolean {
    if (input === this._script) {
      this._compiledFunction = null;
      this._runFunction = null;
    }
    return true;
  }

  call(): any {
    if (!this._compiledFunction) {
      if (typeof this._script._value === 'string') {
        try {
          this._compiledFunction = new Function(this._script._value);
        } catch (err) {
          return new FunctionResult(SCRIPT_ERROR, err.toString());
        }
        let rslt: any;
        try {
          rslt = this._compiledFunction.apply(this._data.getRawObject());
        } catch (err) {
          this._compiledFunction = null;
          return new FunctionResult(SCRIPT_ERROR, err.toString());
        }
        if (typeof rslt === 'function') {
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
        rslt = this._runFunction.apply(this._data.getRawObject());
      } catch (err) {
        return new FunctionResult(SCRIPT_ERROR, err.toString());
      }
      return rslt;
    }
  }
}

JsFunction.prototype.priority = 1;

Classes.add('js', JsFunction);
