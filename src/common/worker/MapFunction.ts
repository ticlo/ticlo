import {Classes} from "../block/Class";
import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {FunctionDesc} from "../block/Descriptor";
import {Block$Property, BlockIO} from "../block/BlockProperty";
import {Block, BlockChildWatch, BlockMode} from "../block/Block";
import {Job} from "../block/Job";
import {DataMap} from "../util/Types";
import {OutputFunction} from "./Output";

export class MapFunction extends BlockFunction implements BlockChildWatch {

  _src: DataMap;
  _srcChanged: boolean;

  _input: any;
  _watchedInput: Block;
  _outputBlock: Block;

  _workers: {[key: string]: Job};

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  input$Changed(input: Block$Property, val: any): boolean {
    switch (input._name) {
      case '$input': {
        return this._inputChanged(input._value);
      }
      case '$src': {
        return this._sourceChanged(input._value);
      }
    }
  }

  _inputChanged(val: any): boolean {
    if (!(val == null || val instanceof Block || val.constructor === Object)) {
      // validate the input
      val = null;
    }
    if (val !== this._input) {
      this._input = val;
      return true;
    }
    return false;
  }

  _sourceChanged(val: any): boolean {
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
    if (data instanceof Block) {
      if (this._srcChanged) {
        this._clearWorkers();
        this._srcChanged = false;
      } else if (this._watchedInput) {
        if (this._watchedInput !== this._input) {
          this._clearWorkers();
        } else {
          return;
        }
      }
      if (this._input.constructor === Object) {
        this._watchObject(this._input);
      } else if (this._input instanceof Block) {
        this._watchBlock(this._input);
      } else {
        this._removeOutputBlock();
      }
    }
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
        this._data.output(null, key);
        this._outputBlock.setValue(key, null);
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
    this._workers[key].destroy();
    this._data.output(null, key);
    this._outputBlock.setValue(key, null);
  }

  _addWorker(key: string, input: any) {
    let child = (this._data as Block).createOutputJob(key, this._src, (this._data as Block)._job._namespace);
    this._workers[key] = child;
    child.updateValue('#input', input);
    this._outputBlock.setBinding(key, `##.${key}.#output`);
  }

  _createOutputBlock() {
    if (!this._outputBlock) {
      this._outputBlock = (this._data as Block).createOutputBlock('$output');
    }
  }

  _removeOutputBlock() {
    if (this._outputBlock) {
      this._data.output(null, '$output');
      this._outputBlock = null;
    }
  }

  onChildChange(property: BlockIO, saved?: boolean) {
    let key = property._name;
    let val = property._value;
    if (val != null && typeof val === 'object') {
      if (!this._workers.hasOwnProperty(key)) {
        this._addWorker(key, val);
      }
    } else {
      if (this._workers.hasOwnProperty(key)) {
        this._removeWorker(key);
        delete this._workers[key];
      }
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
    }
  }

  cancel(): void {
    this._clearWorkers();
  }

  destroy(): void {
    this._clearWorkers();
    this._removeOutputBlock();
  }
}

MapFunction.prototype.priority = 3;
Classes.add('map', MapFunction);
