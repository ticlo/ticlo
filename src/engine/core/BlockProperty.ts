import {ValueDispatcher, Listener} from "./Dispatcher";
import {Block} from "./Block";

export class BlockProperty extends ValueDispatcher implements Listener {

  protected _block: Block;
  _name: string;
  protected _bindingPath: string = null;
  protected _bindingSource: ValueDispatcher = null;

  protected _saved: any = null;

  constructor(block: Block, name: string) {
    super();
    this._block = block;
    this._name = name;
  }

  onChange(val: any): void {
    this.updateValue(val);
  }

  setValue(val: any): void {
    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
      this._bindingPath = null;
      this._bindingSource = null;
    }
    if (val !== this._saved) {
      this._saved = val;
    }
    this.onChange(val);
  }

  getValue(): void {
    return this._value;
  }

  setBinding(path: string): void {
    if (path === this._bindingPath) return;

    if (this._bindingSource !== null) {
      this._bindingSource.unlisten(this);
    }
    this._saved = null;
    this._bindingPath = path;

    if (path !== null) {
      this._bindingSource = this._block.createBinding(path, this);
    } else {
      this._bindingSource = null;
      this.onChange(null);
    }
  }

  _load(val: any): void {
    this._saved = val;
    this.onChange(val);

  }
}

export type BlockAttribute = BlockProperty;

export class BlockIO extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block.inputChanged(this, val);
    }
  }

  updateValue(val: any): any {
    if (this._value === val) {
      return false;
    }
    if (this._value instanceof Block && this._value._prop === this) {
      this._value.destroy();
    }
    this._value = val;
    this._dispatch();
    return true;
  }

  _load(val: any): void {
    if (val instanceof Object && val.hasOwnProperty('#type')) {
      let block = new Block(this._block._job, this);
      this._saved = block;
      this._value = block;
      block._load(val);
      this._value = null; // set to null so the next line will update
      this.onChange(block);
    } else {
      this._saved = val;
      this.onChange(val);
    }
  }

}

export class BlockControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block.inputChanged(this, val);
    }
  }

}