import {Functions} from '../../block/Functions';
import {BlockFunction} from '../../block/BlockFunction';
import {BlockIO} from '../../block/BlockProperty';
import {ErrorEvent, WAIT} from '../../block/Event';
import {Block} from '../../block/Block';
import {BlockDeepProxy} from '../../block/BlockProxy';
import {FunctionDesc} from '../../block/Descriptor';
import {Logger} from '../../util/Logger';

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
    // ignore parent implementation of inputChanged
    if (input._name === 'script') {
      this._compiledFunction = null;
      this._runFunction = null;
      return val !== undefined;
    }
    return Boolean(this._runFunction);
  }

  parseFunction(script: string): Function {
    return new Function('__block__', script);
  }
  applyFunction(f: Function): any {
    return f.call(this._proxy, this._data);
  }

  run(): any {
    if (this._runFunction == null) {
      if (this._compiledFunction == null) {
        let script = this._data.getValue('script');
        if (typeof script === 'string') {
          try {
            this._compiledFunction = this.parseFunction(script);
          } catch (err) {
            return new ErrorEvent(SCRIPT_ERROR, err);
          }
        } else if (script === undefined) {
          return WAIT;
        } else {
          return new ErrorEvent(SCRIPT_ERROR, 'script is not string');
        }
      }
      let rslt;
      try {
        rslt = this.applyFunction(this._compiledFunction);
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
      rslt = this.applyFunction(this._runFunction);
    } catch (err) {
      return new ErrorEvent(SCRIPT_ERROR, err);
    }
    this._data.output(rslt);
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
      desc.src = 'js';

      Functions.add(CustomScriptFunction, desc, namespace);
      return true;
    } catch (err) {
      Logger.error(`invalid script:\n${script}`);
    }
    return false;
  }
}

Functions.add(JsFunction, {
  name: 'js',
  icon: 'txt:js',
  priority: 1,
  properties: [
    {
      name: 'script',
      type: 'string',
      mime: 'text/javascript',
      pinned: true,
    },
    {
      name: '#output',
      type: 'any',
      pinned: true,
      readonly: true,
    },
  ],
  category: 'script',
});
