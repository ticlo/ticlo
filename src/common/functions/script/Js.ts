import {Classes} from "../../block/Class";
import {BlockFunction, FunctionData} from "../../block/BlockFunction";
import {BlockIO, BlockProperty} from "../../block/BlockProperty";
import {ErrorEvent, NOT_READY} from "../../block/Event";
import {Block, BlockMode} from "../../block/Block";
import {BlockDeepProxy} from "../../block/BlockProxy";
import {FunctionDesc} from "../../block/Descriptor";

const SCRIPT_ERROR = 'scriptError';

export class JsFunction extends BlockFunction {

  _compiledFunction: Function;
  _runFunction: Function;

  _proxy: object;

  constructor(block: Block) {
    super(block);
    this._proxy = new Proxy(block, BlockDeepProxy);
  }

  inputChanged(input: BlockIO, val: any): boolean {
    if (input._name === 'script') {
      this._compiledFunction = null;
      this._runFunction = null;
      if (val === undefined) {
        // do not trigger the script to run
        return false;
      }
    }
    return Boolean(this._runFunction);
  }

  run(): any {
    if (this._runFunction == null) {
      if (this._compiledFunction == null) {
        let script = this._data.getValue('script');
        if (typeof script === 'string') {
          try {
            this._compiledFunction = new Function(script);
          } catch (err) {
            return new ErrorEvent(SCRIPT_ERROR, err);
          }
        } else if (script === undefined) {
          return NOT_READY;
        } else {
          return new ErrorEvent(SCRIPT_ERROR, 'script is not string');
        }
      }
      let rslt;
      try {
        rslt = this._compiledFunction.apply(this._proxy);
      } catch (err) {
        this._compiledFunction = null;
        return new ErrorEvent(SCRIPT_ERROR, err);
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
      rslt = this._runFunction.apply(this._proxy);
    } catch (err) {
      return new ErrorEvent(SCRIPT_ERROR, err);
    }
    return rslt;
  }

  static registerClass(script: string, desc: FunctionDesc, namespace?: string) {
    try {
      let compiledFunction = new Function(script);

      class CustomScriptFunction extends JsFunction {
        constructor(block: Block) {
          super(block);
          this._compiledFunction = compiledFunction;

        }
      }

      if (!desc.priority) {
        desc.priority = 1;
      }
      if (!desc.mode) {
        desc.mode = 'always';
      }
      CustomScriptFunction.prototype.priority = desc.priority;
      CustomScriptFunction.prototype.defaultMode = desc.mode;
      CustomScriptFunction.prototype.useLength = Boolean(desc.useLength);

      Classes.add(CustomScriptFunction, desc, namespace);
    } catch (err) {
      // TODO log?
    }
  }
}

JsFunction.prototype.priority = 1;

Classes.add(JsFunction, {
  id: 'js',
  icon: 'txt:js',
  inputs: [{
    name: 'script', type: 'string'
  }]
});
