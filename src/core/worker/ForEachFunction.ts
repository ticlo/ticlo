import {Functions} from '../block/Functions';
import {BlockFunction} from '../block/BlockFunction';
import {BlockIO} from '../block/BlockProperty';
import {Block, BlockChildWatch} from '../block/Block';
import {DataMap} from '../util/DataTypes';
import {Event, EventType} from '../block/Event';
import {MapImpl} from './MapImpl';
import {JobWorker} from './JobWorker';

export class ForEachFunction extends BlockFunction implements BlockChildWatch {
  _src: DataMap | string;
  _srcChanged: boolean = false;

  _applyWorkerChange!: (data: DataMap) => boolean;

  _input: any;
  _inputChanged: boolean = false;
  _watchedInput: Block;

  _funcBlock: Block;
  _outputBlock: Block;

  _workers: Map<string, JobWorker>;

  static inputMap = new Map([
    ['input', ForEachFunction.prototype._onInputChange],
    ['use', MapImpl.prototype._onSourceChange]
  ]);
  getInputMap() {
    return ForEachFunction.inputMap;
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

  run(): any {
    if (!this._funcBlock) {
      this._funcBlock = this._data.createOutputBlock('#func');
    }
    if (this._srcChanged) {
      this._clearWorkers();
      this._srcChanged = false;
    } else if (!this._inputChanged) {
      this._checkChanges();
      return;
    } else if (this._watchedInput) {
      // since input is changed
      this._clearWorkers();
    }
    if (this._src) {
      this._inputChanged = false;
      // watch input when input changed or use changed
      if (this._input != null) {
        if (this._input instanceof Block) {
          this._watchBlock(this._input);
          return;
        } else {
          this._watchObject(this._input);
          return;
        }
      }
    }
    this._removeOutputBlock();
  }

  onChildChange(property: BlockIO, saved?: boolean) {
    this._childChanges.add(property._name);
    if (this._childChanges.size === 1) {
      this._data._onCall(new Event('childChanged'));
    }
  }

  _childChanges: Set<string> = new Set<string>();

  _checkChanges() {
    for (let key of this._childChanges) {
      let val = this._watchedInput.getValue(key);
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
    this._createOutputBlock();
    if (this._workers) {
      // update existing workers
      let oldWorkers = this._workers;
      this._workers = new Map();
      for (let key in obj) {
        let input = obj[key];
        if (input === undefined) {
          continue;
        }
        if (oldWorkers.has(key)) {
          oldWorkers.get(key).updateInput(input);
          this._workers.set(key, oldWorkers.get(key));
          oldWorkers.set(key, undefined);
        } else {
          this._addWorker(key, input);
        }
      }
      for (let [key, oldWorker] of oldWorkers) {
        if (oldWorker) {
          oldWorker.destroy();
          this._funcBlock.deleteValue(key);
          this._outputBlock.deleteValue(key);
        }
      }
    } else {
      this._workers = new Map();
      for (let key in obj) {
        this._addWorker(key, obj[key]);
      }
    }
  }

  // when input is Block
  _watchBlock(block: Block) {
    this._createOutputBlock();
    this._workers = new Map();
    this._watchedInput = block;
    block.forEach((field: string, prop: BlockIO) => {
      this._addWorker(field, prop._value);
    });
    block.watch(this);
  }

  _removeWorker(key: string) {
    this._funcBlock.deleteValue(key);
    this._outputBlock.deleteValue(key);
  }

  _addWorker(key: string, input: any) {
    let child = this._funcBlock.createOutputJob(JobWorker, key, this._src, null, this._applyWorkerChange);
    this._workers.set(key, child);
    child.updateInput(input);
    this._outputBlock.setBinding(key, `##.#func.${key}.#outputs`);
  }

  _createOutputBlock() {
    if (!this._outputBlock) {
      this._outputBlock = this._data.createOutputBlock('#output');
    }
  }

  _removeOutputBlock() {
    if (this._outputBlock) {
      this._data.deleteValue('#output');
      this._outputBlock = null;
    }
  }

  _clearWorkers() {
    if (this._workers) {
      for (let [key, worker] of this._workers) {
        this._removeWorker(key);
      }
      this._workers = null;
    }
    if (this._watchedInput) {
      this._watchedInput.unwatch(this);
      this._watchedInput = null;
      this._childChanges.clear();
    }
  }

  cancel(reason: EventType = EventType.TRIGGER) {
    this._clearWorkers();
    return true;
  }

  destroy(): void {
    this._clearWorkers();
    if (!this._data._destroyed) {
      if (this._outputBlock) {
        this._data.deleteValue('#output');
      }
    }
    this._outputBlock = null;
    this._funcBlock = null;
    this._data.deleteValue('#func');
    super.destroy();
  }
}

ForEachFunction.prototype._applyWorkerChange = MapImpl.prototype._applyWorkerChange;

Functions.add(ForEachFunction, {
  name: 'foreach',
  priority: 1,
  properties: [
    {name: 'input', type: 'any'},
    {name: 'use', type: 'worker'},
    {name: '#output', type: 'any', readonly: true}
  ],
  category: 'repeat'
});
