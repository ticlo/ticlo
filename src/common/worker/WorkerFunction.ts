import { Classes } from "../block/Class";
import { BlockFunction, FunctionData } from "../block/BlockFunction";
import { FunctionDesc } from "../block/Descriptor";
import { BlockIO } from "../block/BlockProperty";
import { Block, BlockMode } from "../block/Block";
import { Job } from "../block/Job";
import { DataMap } from "../util/Types";

export class WorkerFunction extends BlockFunction {
  _namespace: string;
  _nested: Job;
  _saved: DataMap;

  constructor(block: FunctionData, data: DataMap) {
    super(block);
    this._saved = data;

  }

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  run(data: FunctionData): any {
    if (data instanceof Block) {
      this._nested = new Job(data, data, data.getProperty('$worker'), true);
      this._nested._namespace = this._namespace;
      // the first round of queue is hardcoded here
      this._nested._queued = true;
      data.updateValue('$worker', this._nested);
      this._nested.load(this._saved);
      this._nested.updateValue('#input', data);

      if (this._nested._loop) {
        // run the nested loop
        this._nested._loop._loopScheduled = true;
        this._nested.run();
      }
      // clear the queue status of the nested job
      this._nested._queued = false;
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

    class CustomNestedJob extends WorkerFunction {
      constructor(block: FunctionData) {
        super(block, data);
        this.priority = defaultPriority;
        this.defaultMode = defaultMode;
        this._namespace = namespace;
      }
    }

    // TODO descriptor
    Classes.add(className, CustomNestedJob);
  }
}

