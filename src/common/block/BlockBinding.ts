import {ValueDispatcher, Listener, Dispatcher} from "./Dispatcher";
import {Block} from "./Block";
import {BlockProperty} from "./BlockProperty";


export class BlockBinding extends ValueDispatcher<any> implements Listener<any> {

  private _block: Block;
  private _path: string;
  private _field: string;

  private _source: any = null;

  _parent: ValueDispatcher<any> = null;

  private _prop: BlockProperty = null;

  constructor(block: Block, path: string, field: string) {
    super();
    this._block = block;
    this._path = path;
    this._field = field;
  }

  unlisten(listener: Listener<any>) {
    if (this._listeners) {
      this._listeners.delete(listener);
      if (this._prop != null) {
        this._prop.unlisten(listener);
      }
      if (this._listeners.size === 0) {
        this.destroy();
      }
    }
  }


  listen(listener: Listener<any>) {
    this._listeners.add(listener);
    if (this._prop != null) {
      this._prop.listen(listener);
    } else if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  onSourceChange(source: Dispatcher<any>) {
    // do nothing
  }

  onChange(val: any): any {
    if (this._source === val) {
      return;
    }
    this._source = val;
    if (val instanceof Block) {
      this._propChanged(val.getProperty(this._field));
    } else {
      this._propChanged(null);
      if (val != null && typeof val === 'object' && val.hasOwnProperty(this._field)) {
        // drill down into object children
        this.updateValue(val[this._field]);
      } else {
        this.updateValue(undefined);
      }
    }
  }

  private _propChanged(prop: BlockProperty): boolean {
    if (prop === this._prop) return false;
    if (this._prop) {
      for (let listener of this._listeners) {
        this._prop.unlisten(listener);
        listener.onSourceChange(null);
      }
    }
    this._prop = prop;
    if (this._prop) {
      this._value = undefined;
      for (let listener of this._listeners) {
        this._prop.listen(listener);
      }
    } else {
      this._value = undefined;
    }
    return true;
  }

  destroy() {
    this._propChanged(null);
    if (this._parent) {
      this._parent.unlisten(this);
    }
    this._block._removeBinding(this._path);
    this._listeners = null;
  }
}


