import {Types} from "../../block/Type";
import {BlockFunction, FunctionData} from "../../block/BlockFunction";
import {BlockIO, BlockProperty} from "../../block/BlockProperty";
import {ErrorEvent, NOT_READY} from "../../block/Event";
import {Block, BlockMode} from "../../block/Block";
import {BlockDeepProxy} from "../../block/BlockProxy";
import {FunctionDesc} from "../../block/Descriptor";
import {Logger} from "../../util/Logger";

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
      return val !== undefined;
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

  static registerType(script: string, desc: FunctionDesc, namespace?: string): boolean {
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
        desc.mode = 'onLoad';
      }
      CustomScriptFunction.prototype.priority = desc.priority;
      CustomScriptFunction.prototype.defaultMode = desc.mode;
      CustomScriptFunction.prototype.useLength = Boolean(desc.useLength);

      Types.add(CustomScriptFunction, desc, namespace);
      return true;
    } catch (err) {
      Logger.error(`invalid script:\n${script}`);
    }
    return false;
  }
}

JsFunction.prototype.priority = 1;

Types.add(JsFunction, {
  name: 'js',
  icon: 'txt:js',
  mode: 'onChange',
  properties: [{
    name: 'script', type: 'string', visible: 'high'
  }]
});
