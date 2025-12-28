import {Functions} from '../block/Functions.js';
import {StatefulFunction} from '../block/BlockFunction.js';
import {BlockIO, BlockProperty} from '../block/BlockProperty.js';
import {Block, BlockChildWatch} from '../block/Block.js';
import {DataMap} from '../util/DataTypes.js';
import {Event, EventType} from '../block/Event.js';
import {RepeaterWorker} from './WorkerFlow.js';
import {Resolver} from '../block/Resolver.js';
import {defaultConfigs} from '../block/Descriptor.js';
import {FunctionOutput} from '../block/FunctonData.js';
import {WorkerControl, type WorkerHost} from './WorkerControl.js';

class MultiWorkerOutput implements FunctionOutput {
  constructor(
    public func: MultiWorkerFunction,
    public key: string
  ) {}

  _overrideValue: any;
  _result: any = {};
  output(value: any, field?: string): void {
    if (field === '#return') {
      this._overrideValue = value;
    } else {
      this._result = {...this._result, [field]: value};
    }
    if (this._overrideValue === undefined) {
      // let ForEachFunction decide whether it uses spread operator to create new object
      this._result = this.func._output(this.key, this._result);
    } else {
      this.func._output(this.key, this._overrideValue);
    }
  }
}

export class MultiWorkerFunction extends StatefulFunction implements BlockChildWatch, WorkerHost {
  readonly workerField = 'use';
  readonly control: WorkerControl;

  _input: any;
  _inputChanged: boolean = false;
  _watchedInputBlock: Block;

  _funcBlock: Block;

  _workers: Map<string, RepeaterWorker>;

  _outputCache: any;
  _currentOutput: any;

  static inputMap = new Map([
    ['input', MultiWorkerFunction.prototype._onInputChange],
    ['use', WorkerControl.onUseChange],
  ]);
  getInputMap() {
    return MultiWorkerFunction.inputMap;
  }

  _onInputChange(val: any): boolean {
    if (!Object.isExtensible(val)) {
      // validate the input
      val = null;
    }
    if (val !== this._input) {
      this._input = val;
      this._inputChanged = true;
      return true;
    }
    return false;
  }

  constructor(data: Block) {
    super(data);
    this.control = new WorkerControl(this, data);
  }

  run(): any {
    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#flows');
    }
    if (this.control._srcChanged) {
      this._clearWorkers();
      this.control._srcChanged = false;
    } else if (!this._inputChanged) {
      this._checkChanges();
      this._applyPendingOutput();
      return;
    } else {
      this._clearWorkers();
    }
    if (this.control.isReady()) {
      this._inputChanged = false;
      // watch input when input changed or use changed
      if (this._input && typeof this._input === 'object') {
        if (this._input instanceof Block) {
          this._watchBlock(this._input);
        } else {
          this._watchObject(this._input);
        }
        this._applyPendingOutput();
        return;
      }
    }
    // no input, delete output
    this._clearWorkers();
    this._deleteOutput();
  }

  onChildChange(property: BlockProperty, saved?: boolean) {
    this._childChanges.add(property._name);
    if (this._childChanges.size === 1) {
      // use _onCall so it triggers synchronously in sync mode
      this._data._onCall(new Event('childChanged'));
    }
  }

  _childChanges: Set<string> = new Set<string>();

  _checkChanges() {
    for (const key of this._childChanges) {
      const val = this._watchedInputBlock.getValue(key);
      if (val !== undefined) {
        if (this._workers.has(key)) {
          this._workers.get(key).updateInput(val);
        } else {
          this._addWorker(key, val);
        }
      } else {
        if (this._workers.has(key)) {
          this._removeWorker(key);
        }
      }
    }
    this._childChanges.clear();
  }

  // when input is regular Object
  _watchObject(obj: DataMap) {
    if (this._workers) {
      // update existing workers
      const oldWorkers = this._workers;
      this._workers = new Map();
      for (const key in obj) {
        const input = obj[key];
        if (input === undefined) {
          continue;
        }
        if (oldWorkers.has(key)) {
          oldWorkers.get(key).updateInput(input);
          this._workers.set(key, oldWorkers.get(key));
          // remove from oldWorkers so it won't be destroyed later
          oldWorkers.set(key, undefined);
        } else {
          this._addWorker(key, input);
        }
      }
      // destroy old workers
      for (const [key, oldWorker] of oldWorkers) {
        if (oldWorker) {
          oldWorker.destroy();
          this._funcBlock.deleteValue(key);
          this._output(key, undefined);
        }
      }
    } else {
      if (Array.isArray(obj)) {
        this._outputCache = new Array(obj.length);
        this._currentOutput = [];
      } else {
        this._outputCache = {};
        this._currentOutput = {};
      }
      this._workers = new Map();
      for (const key in obj) {
        this._addWorker(key, obj[key]);
      }
    }
  }

  // when input is Block
  _watchBlock(block: Block) {
    this._workers = new Map();
    this._outputCache = {};
    this._currentOutput = {};
    this._watchedInputBlock = block;
    block.forEach((field: string, value: unknown, prop: BlockIO) => {
      this._addWorker(field, value);
    });
    block.watch(this);
  }

  _removeWorker(key: string) {
    this._funcBlock.deleteValue(key);
    this._output(key, undefined);
  }

  _addWorker(key: string, input: any) {
    const {src, saveCallback} = this.control.getSaveParameter();
    const output = new MultiWorkerOutput(this, key);
    const child = this._funcBlock.createOutputFlow(RepeaterWorker, key, src, output, saveCallback);
    this._workers.set(key, child);
    child.updateInput(input);
  }

  _pendingOutput = false;
  _output(key: string, value: any): any {
    if (value === this._currentOutput[key]) {
      if (value && value.constructor === Object) {
        value = {...value};
      } else {
        return value;
      }
    }
    if (value === undefined) {
      delete this._outputCache[key];
    } else {
      this._outputCache[key] = value;
    }
    this._applyOuputLater();
    return value;
  }
  _applyOuputLater() {
    if (!this._pendingOutput) {
      this._pendingOutput = true;
      Resolver.callLater(this._applyPendingOutput);
    }
  }
  _applyPendingOutput = () => {
    if (this._data && this._pendingOutput) {
      this._pendingOutput = false;

      this._currentOutput = this._outputCache;
      if (Array.isArray(this._input)) {
        this._outputCache = [...this._currentOutput];
      } else {
        this._outputCache = {...this._currentOutput};
      }
      this._data.output(this._currentOutput);
    }
  };

  _deleteOutput() {
    this._data.deleteValue('#output');
  }

  _clearWorkers() {
    if (this._workers) {
      for (const [key, worker] of this._workers) {
        this._removeWorker(key);
      }
      this._workers = null;
    }
    if (this._watchedInputBlock) {
      this._watchedInputBlock.unwatch(this);
      this._watchedInputBlock = null;
      this._childChanges.clear();
    }
    this._pendingOutput = false;
    this._currentOutput = null;
    this._outputCache = null;
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    this._clearWorkers();
    return true;
  }

  cleanup(): void {
    this.control.destroy();
    this._data.deleteValue('#output');
    this._data.deleteValue('#flows');
    if (this._watchedInputBlock) {
      this._watchedInputBlock.unwatch(this);
      this._watchedInputBlock = null;
    }
  }

  destroy(): void {
    this.control.destroy();
    this._funcBlock = null;
    if (this._watchedInputBlock) {
      this._watchedInputBlock.unwatch(this);
      this._watchedInputBlock = null;
    }
    super.destroy();
  }
}

Functions.add(MultiWorkerFunction, {
  name: 'multi-worker',
  priority: 1,
  icon: 'fas:list',
  configs: defaultConfigs.concat('#cancel'),
  properties: [
    {name: 'input', pinned: true, type: 'object'},
    {name: 'use', type: 'worker', init: ''},
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  category: 'repeat',
});
