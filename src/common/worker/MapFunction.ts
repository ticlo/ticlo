import {Classes} from "../block/Class";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Block, BlockChildWatch, BlockMode} from "../block/Block";
import {Job} from "../block/Job";
import {DataMap, isSavedBlock} from "../util/Types";
import {OutputFunction} from "./Output";
import {Event} from "../block/Event";
import {MapImpl} from "./MapImpl";

export class MapFunction extends BlockFunction implements BlockChildWatch {

  _src: DataMap;
  _srcChanged: boolean = false;
  _onSourceChange!: (val: any) => boolean;

  _input: any;
  _inputChanged: boolean = false;
  _watchedInput: Block;

  _funcBlock: Block;
  _outputBlock: Block;

  _workers: {[key: string]: Job};

  inputChanged(input: BlockIO, val: any): boolean {
    switch (input._name) {
      case 'input': {
        return this._onInputChange(input._value);
      }
      case 'src': {
        return this._onSourceChange(input._value);
      }
    }
    return false;
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
      // watch input when input changed or src changed
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
        if (this._workers.hasOwnProperty(key)) {
          this._workers[key].updateInput(val);
        } else {
          this._addWorker(key, val);
        }
      } else {
        if (this._workers.hasOwnProperty(key)) {
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
      this._workers = {};
      for (let key in obj) {
        let input = obj[key];
        if (input === undefined) {
          continue;
        }
        if (oldWorkers.hasOwnProperty(key)) {
          oldWorkers[key].updateInput(input);
          this._workers[key] = oldWorkers[key];
          oldWorkers[key] = undefined;
        } else {
          this._addWorker(key, input);
        }
      }
      for (let key in oldWorkers) {
        let oldWorker = oldWorkers[key];
        if (oldWorker) {
          oldWorker.destroy();
          this._funcBlock.deleteValue(key);
          this._outputBlock.deleteValue(key);
        }
      }
    } else {
      this._workers = {};
      for (let key in obj) {
        this._addWorker(key, obj[key]);
      }
    }
  }

  // when input is Block
  _watchBlock(block: Block) {
    this._createOutputBlock();
    this._workers = {};
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
    let child = this._funcBlock.createOutputJob(key, this._src, this._data._job._namespace);
    this._workers[key] = child;
    child.updateInput(input);
    this._outputBlock.setBinding(key, `##.#func.${key}.#output`);
  }

  _createOutputBlock() {
    if (!this._outputBlock) {
      this._outputBlock = this._data.createOutputBlock('output');
    }
  }

  _removeOutputBlock() {
    if (this._outputBlock) {
      this._data.deleteValue('output');
      this._outputBlock = null;
    }
  }

  _clearWorkers() {
    if (this._workers) {
      for (let key in this._workers) {
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

  cancel(): void {
    this._clearWorkers();
  }

  destroy(): void {
    this._clearWorkers();
    if (!this._data._destroyed) {
      if (this._outputBlock) {
        this._data.deleteValue('output');
      }
    }
    this._outputBlock = null;
    this._funcBlock = null;
    super.destroy();
  }
}

// implements from MapImpl
MapFunction.prototype._onSourceChange = MapImpl.prototype._onSourceChange;

MapFunction.prototype.priority = 3;
Classes.add('map', MapFunction);
