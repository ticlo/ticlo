import {ValueDispatcher, IListen} from "Dispatcher";
import {Block} from "Block"

export class BlockProperty extends ValueDispatcher implements IListen {

  protected _block: Block;
  protected _name: string;
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
  };

  setValue(val: any): void {
    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
      this._bindingPath = null;
      this._bindingSource = null
    }
    if (val !== this._saved) {
      this._saved = val;
    }
    this.onChange(val);
  };

  getValue(): void {
    return this._value;
  };

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
  };

  _load(val: any): void {
    this.onChange(val);
    this._saved = val;
  };
}

export class BlockInput extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block.inputChanged(this, val);
    }
  };
}