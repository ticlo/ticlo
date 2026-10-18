import {globalFunctions} from '../block/FunctionLib.ts';
import {StatefulFunction} from '../block/BlockFunction.ts';
import {BlockIO, BlockProperty} from '../block/BlockProperty.ts';
import {Block, BlockChildWatch} from '../block/Block.ts';
import {DataMap} from '../util/DataTypes.ts';
import {Event, EventType} from '../block/Event.ts';
import {RepeaterWorker} from './WorkerFlow.ts';
import {Resolver} from '../block/Resolver.ts';
import {defaultConfigs} from '../block/Descriptor.ts';
import {FunctionOutput} from '../block/FunctonData.ts';
import {WorkerControl, type WorkerHost} from './WorkerControl.ts';

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
  _key = '';
  // Worker keys in output array order.
  _arrayKeys: string[];
  _watchedInputBlock: Block;

  _funcBlock: Block;

  _workers: Map<string, RepeaterWorker>;

  _outputCache: DataMap;
  _currentOutput: DataMap;

  static inputMap = new Map([
    ['input', MultiWorkerFunction.prototype._onInputChange],
    ['key', MultiWorkerFunction.prototype._onKeyChange],
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

  _onKeyChange(val: unknown): boolean {
    const key = typeof val === 'string' ? val : '';
    if (key !== this._key) {
      this._key = key;
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
      this._funcBlock = this._data.createOutputBlock('#workers');
    }
    if (this.control._srcChanged) {
      this._clearWorkers();
      this.control._srcChanged = false;
    } else if (!this._inputChanged) {
      this._checkChanges();
      this._applyPendingOutput();
      return;
    } else if (this._watchedInputBlock || this._input instanceof Block) {
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
    this._arrayKeys = null;
    if (Array.isArray(obj)) {
      if (this._key) {
        const inputs: DataMap = Object.create(null);
        this._arrayKeys = [];
        for (const input of obj) {
          const value = input instanceof Block ? input.getValue(this._key) : input?.[this._key];
          if (typeof value !== 'string' && typeof value !== 'number') {
            continue;
          }
          const key = String(value);
          if (Object.hasOwn(inputs, key)) {
            continue;
          }
          inputs[key] = input;
          this._arrayKeys.push(key);
        }
        obj = inputs;
      } else {
        this._arrayKeys = Array.from({length: obj.length}, (_, index) => String(index));
      }
    }
    this._workers ??= new Map();
    this._currentOutput ??= Object.create(null);
    this._outputCache ??= Object.create(null);
    const removedKeys = new Set(this._workers.keys());
    for (const key in obj) {
      const input = obj[key];
      if (input === undefined) {
        continue;
      }
      removedKeys.delete(key);
      const worker = this._workers.get(key);
      if (worker) {
        worker.updateInput(input);
      } else {
        this._addWorker(key, input);
      }
    }
    for (const key of removedKeys) {
      this._removeWorker(key);
    }
    this._applyOuputLater();
  }

  // when input is Block
  _watchBlock(block: Block) {
    this._workers = new Map();
    this._outputCache = Object.create(null);
    this._currentOutput = Object.create(null);
    this._watchedInputBlock = block;
    block.forEach((field: string, value: unknown, prop: BlockIO) => {
      this._addWorker(field, value);
    });
    block.watch(this);
  }

  _removeWorker(key: string) {
    this._funcBlock.deleteValue(key);
    this._workers.delete(key);
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
        // Re-emit an object with a fresh identity so downstream shallow-change
        // checks see nested field changes from the worker.
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
      this._outputCache = Object.assign(Object.create(null), this._currentOutput);
      this._data.output(
        this._arrayKeys ? this._arrayKeys.map((key) => this._currentOutput[key]) : {...this._currentOutput}
      );
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
    this._arrayKeys = null;
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
    this._data.deleteValue('#workers');
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

globalFunctions.addFactory(MultiWorkerFunction, {
  name: 'multi-worker',
  priority: 1,
  icon: 'fas:list',
  configs: defaultConfigs.concat('#cancel'),
  properties: [
    {name: 'input', pinned: true, type: 'object'},
    {name: 'key', type: 'string'},
    {name: 'use', type: 'worker', init: ''},
    {name: '#output', pinned: true, type: 'any', readonly: true},
  ],
  category: 'repeat',
});
