import {Classes} from "../block/Class";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Job} from "../block/Job";
import {Block, BlockMode} from "../block/Block";
import {DataMap} from "../util/Types";

export class WorkerFunction extends BlockFunction {
  _namespace: string;
  _nested: Job;
  _src: DataMap;

  constructor(block: FunctionData, data: DataMap) {
    super(block);
    this._src = data;

  }

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(data: FunctionData): any {
    if (data instanceof Block) {
      this._nested = data.createOutputJob('$worker', this._src, this._namespace);
      this._nested.updateValue('#input', data);
    }
  }

  destroy(): void {
    if (this._nested) {
      if (this._data instanceof Block && !this._data._destroyed) {
        this._data.updateValue('$worker', null);
      }
      this._nested = null;
    }
  }

  static registerClass(className: string,
                       data: DataMap,
                       defaultMode: BlockMode = 'always',
                       defaultPriority: number = 1) {
    let namespace: string;
    let slashPos = className.indexOf('/');
    if (slashPos > 0) {
      namespace = className.substr(0, slashPos);
    }

    class CustomWorkerFunction extends WorkerFunction {
      constructor(block: FunctionData) {
        super(block, data);
        this.priority = defaultPriority;
        this.defaultMode = defaultMode;
      }
    }

    CustomWorkerFunction.prototype._namespace = namespace;

    // TODO descriptor
    Classes.add(className, CustomWorkerFunction);
  }
}

