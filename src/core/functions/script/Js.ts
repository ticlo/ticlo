import { Classes } from "../../block/Class";
import { BlockFunction, FunctionData } from "../../block/BlockFunction";
import { BlockIO, BlockProperty } from "../../block/BlockProperty";
import { FunctionResult } from "../../block/Event";
import { BlockMode } from "../../block/Block";

const SCRIPT_ERROR = 'scriptError';

export class JsFunction extends BlockFunction {

  _compiledFunction: Function;
  _runFunction: Function;

  constructor(block: FunctionData) {
    super(block);
  }

  inputChanged(input: BlockIO, val: any): boolean {
    if (input._name === 'script') {
      this._compiledFunction = null;
      this._runFunction = null;
    }
    return true;
  }

  run(data: FunctionData): any {
    if (this._runFunction == null) {
      if (this._compiledFunction == null) {
        let script = data.getValue('script');
        if (typeof script === 'string') {
          try {
            this._compiledFunction = new Function(script);
          } catch (err) {
            return new FunctionResult(SCRIPT_ERROR, err.toString());
          }
        } else {
          return null;
        }
      }
      let rslt;
      try {
        rslt = this._compiledFunction.apply(data.getRawObject());
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
    }
    let rslt: any;
    try {
      rslt = this._runFunction.apply(data.getRawObject());
    } catch (err) {
      return new FunctionResult(SCRIPT_ERROR, err.toString());
    }
    return rslt;
  }

  static registerClass(className: string,
                         script: string,
                         defaultMode: BlockMode = 'always',
                         defaultPriority: number = 1) {
    try {
      let compiledFunction = new Function(script);

      class CustomScriptFunction extends JsFunction {
        constructor(block: FunctionData) {
          super(block);
          this._compiledFunction = compiledFunction;
          this.priority = defaultPriority;
          this.defaultMode = defaultMode;
        }
      }

      Classes.add(className, CustomScriptFunction);
    } catch (err) {
      // TODO log?
    }
  }
}

JsFunction.prototype.priority = 1;

Classes.add('js', JsFunction);
