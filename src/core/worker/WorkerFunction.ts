import {Types} from '../block/Type';
import {BlockFunction, FunctionData} from '../block/BlockFunction';
import {FunctionDesc} from '../block/Descriptor';
import {BlockIO} from '../block/BlockProperty';
import {Block, Job} from '../block/Block';
import {DataMap} from '../util/DataTypes';

export class WorkerFunction extends BlockFunction {
  readonly type: string;
  _namespace: string;
  _funcJob: Job;

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(): any {
    this._funcJob = this._data.createOutputJob('#func', this.type, this._data);
    this._funcJob.updateInput(this._data);
  }

  static registerType(data: DataMap, desc: FunctionDesc, namespace?: string) {
    class CustomWorkerFunction extends WorkerFunction {
      static ticlWorkerData = data;
    }

    if (!desc.priority) {
      desc.priority = 1;
    }
    desc.src = 'worker';

    CustomWorkerFunction.prototype._namespace = namespace;

    // TODO descriptor
    Types.add(CustomWorkerFunction, desc, namespace);
  }
}
