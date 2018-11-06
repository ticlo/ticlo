import {Types} from "../block/Type";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Block, Job} from "../block/Block";
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

  run(): any {
    this._funcJob = this._data.createOutputJob('#func', this._src, this._data, this._namespace);
    this._funcJob.updateInput(this._data);
  }

  static registerType(data: DataMap, desc: FunctionDesc, namespace?: string) {

    class CustomWorkerFunction extends WorkerFunction {
      constructor(block: Block) {
        super(block, data);
      }
    }

    if (!desc.priority) {
      desc.priority = 0;
    }
    if (!desc.mode) {
      desc.mode = 'always';
    }

    CustomWorkerFunction.prototype.priority = desc.priority;
    CustomWorkerFunction.prototype.defaultMode = desc.mode;
    CustomWorkerFunction.prototype.useLength = Boolean(desc.useLength);

    CustomWorkerFunction.prototype._namespace = namespace;

    // TODO descriptor
    Types.add(CustomWorkerFunction, desc, namespace);
  }
}

