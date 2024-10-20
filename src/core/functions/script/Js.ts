import {Functions} from '../../block/Functions';
import {BaseFunction, StatefulFunction} from '../../block/BlockFunction';
import {BlockIO} from '../../block/BlockProperty';
import {ErrorEvent, WAIT} from '../../block/Event';
import {Block} from '../../block/Block';
import {BlockDeepProxy} from '../../block/BlockProxy';
import {FunctionDesc} from '../../block/Descriptor';
import {Logger} from '../../util/Logger';

export const SCRIPT_ERROR = 'scriptError';

export class JsFunction extends BaseFunction<Block> {
  _compiledFunction: Function;
  _runFunction: Function;
  // whether compiled function is run for the first time
  _preProcessed: boolean;

  constructor(block: Block) {
    super(block);
  }

  getDataProxy() {
    return new Proxy(this._data, BlockDeepProxy);
  }

  inputChanged(input: BlockIO, val: any): boolean {
    // ignore parent implementation of inputChanged
    if (input._name === 'script') {
      this._compiledFunction = null;
      this._runFunction = null;
      this._preProcessed = false;
      return val !== undefined;
    }
    return Boolean(this._runFunction);
  }

  parseFunction(script: string): Function {
    return new Function(script);
  }
  applyFunction(): any {
    if (this._runFunction) {
      return this._runFunction.call(this.getDataProxy());
    }
    return undefined;
  }
  // first time script is compiled
  preProcessCompileResult() {
    let result: unknown;
    try {
      result = this._compiledFunction.call(this.getDataProxy());
    } catch (err) {
      this._compiledFunction = null;
      return new ErrorEvent(SCRIPT_ERROR, err);
    }
    if (typeof result === 'function') {
      // let the function run again
      this._runFunction = result;
    } else {
      this._runFunction = this._compiledFunction;
      return result;
    }
  }

  run(): any {
    let result: unknown;
    if (!this._preProcessed) {
      this._preProcessed = true;
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
      result = this.preProcessCompileResult();
      if (this._runFunction === this._compiledFunction) {
        return result;
      }
    }
    try {
      result = this.applyFunction();
    } catch (err) {
      return new ErrorEvent(SCRIPT_ERROR, err);
    }

    this._data.output(result);
  }

  cleanup() {
    this._data.output(undefined);
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
