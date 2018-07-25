import {Classes} from "../block/Class";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Job} from "../block/Job";
import {Block, BlockMode} from "../block/Block";
import {DataMap} from "../util/Types";

export class WorkerFunction extends BlockFunction {
  _namespace: string;
  _funcJob: Job;
  _src: DataMap;

  constructor(block: Block, data: DataMap) {
    super(block);
    this._src = data;

  }

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(called: boolean): any {
    this._funcJob = this._data.createOutputJob('#func', this._src, this._data, this._namespace);
    this._funcJob.updateInput(this._data);
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
      constructor(block: Block) {
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

