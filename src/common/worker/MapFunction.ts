import {Classes} from "../block/Class";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {BlockIO} from "../block/BlockProperty";
import {Block, BlockChildWatch, BlockMode} from "../block/Block";
import {Job} from "../block/Job";
import {DataMap} from "../util/Types";
import {OutputFunction} from "./Output";
import {Event} from "../block/Event";

export class MapFunction extends BlockFunction implements BlockChildWatch {

  _src: DataMap;
  _srcChanged: boolean;

  _input: any;
  _inputChanged: boolean;
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
    if (!(val == null || val instanceof Block || val.constructor === Object)) {
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

  _onSourceChange(val: any): boolean {
    // TODO allow string src for class name
    if (val != null && val.constructor === Object) {
      this._src = val;
      this._srcChanged = true;
      return true;
    }
    if (this._src) {
      this._src = undefined;
      this._srcChanged = true;
      return true;
    }
    return false;
  }

  run(data: FunctionData): any {
    if (!this._funcBlock || this._funcBlock._destroyed) {
      this._funcBlock = (data as Block).createOutputBlock('#func');
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
    this._inputChanged = false;
    // watch input when input changed or src changed
    if (this._input != null) {
      if (this._input.constructor === Object) {
        this._watchObject(this._input);
        return;
      } else if (this._input instanceof Block) {
        this._watchBlock(this._input);
        return;
      }
    }
    this._removeOutputBlock();
  }

  onChildChange(property: BlockIO, saved?: boolean) {
    this._childChanges.add(property._name);
    if (this._childChanges.size === 1) {
      (this._data as Block)._onCall(new Event('childChanged'));
    }
  }

  _childChanges: Set<string> = new Set<string>();

  _checkChanges() {
    for (let key of this._childChanges) {
      let val = this._watchedInput.getValue(key);
      if (val != null && typeof val === 'object') {
        if (this._workers.hasOwnProperty(key)) {
          this._workers[key].updateValue('#input', val);
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
        if (oldWorkers.hasOwnProperty(key)) {
          oldWorkers[key].updateValue('#input', obj[key]);
          this._workers[key] = oldWorkers[key];
          delete oldWorkers[key];
        } else {
          this._addWorker(key, obj[key]);
        }
      }
      for (let key in oldWorkers) {
        oldWorkers[key].destroy();
        this._data.output(undefined, key);
        this._outputBlock.setValue(key, undefined);
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
      if (prop._value != null && typeof prop._value === 'object') {
        this._addWorker(field, prop._value);
      }
    });
    block.watch(this);
  }

  _removeWorker(key: string) {
    this._funcBlock.output(undefined, key);
    this._outputBlock.setValue(key, undefined);
  }

  _addWorker(key: string, input: any) {
    let child = this._funcBlock.createOutputJob(key, this._src, (this._data as Block)._job._namespace);
    this._workers[key] = child;
    child.updateValue('#input', input);
    this._outputBlock.setBinding(key, `##.#func.${key}.#output`);
  }

  _createOutputBlock() {
    if (!this._outputBlock) {
      this._outputBlock = (this._data as Block).createOutputBlock('output');
    }
  }

  _removeOutputBlock() {
    if (this._outputBlock) {
      this._data.output(undefined, 'output');
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
    if (!(this._data as Block)._destroyed) {
      if (this._outputBlock) {
        this._data.output(undefined, 'output');
      }
      if (this._funcBlock) {
        this._data.output(undefined, '#func');

      }
    }
    this._outputBlock = null;
    this._funcBlock = null;
  }
}

MapFunction.prototype.priority = 3;
Classes.add('map', MapFunction);
