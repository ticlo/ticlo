import { ValueDispatcher, Listener, Dispatcher } from "./Dispatcher";
import { Block } from "./Block";

export class BlockProperty extends ValueDispatcher implements Listener {

  protected _block: Block;
  _name: string;
  protected _bindingPath: string;
  protected _bindingSource: ValueDispatcher;

  protected _saved: any = null;

  constructor(block: Block, name: string) {
    super();
    this._block = block;
    this._name = name;
  }

  onSourceChange(prop: Dispatcher) {
    // do nothing
  }

  _valueChanged(): void {
    // to be overridden
  }

  updateValue(val: any): boolean {
    return this.onChange(val);
  }

  onChange(val: any): boolean {
    if (this._value === val) {
      return false;
    }
    if (this._value instanceof Block && this._value._prop === this) {
      this._value.destroy();
    }
    this._value = val;
    this._valueChanged();
    this._dispatch();
    return true;
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

    if (this._bindingSource != null) {
      this._bindingSource.unlisten(this);
    }
    this._saved = null;
    this._bindingPath = path;

    if (path != null) {
      this._bindingSource = this._block.createBinding(path, this);
    } else {
      this._bindingSource = null;
      this.onChange(null);
    }
  }

  _load(val: any): void {
    if (val instanceof Object && val != null && val.hasOwnProperty('#class')) {
      let block = new Block(this._block._job, this._block, this);
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

export class BlockIO extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged(): void {
    this._block.inputChanged(this, this._value);
  }
}

// holds helper logic that output to another property of its owner
// property name is `!${relatedPropertyName}`
export class BlockPropertyHelper extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }
}
