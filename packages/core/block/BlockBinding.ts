import {PropDispatcher, PropListener} from './Dispatcher';
import {Block} from './Block';
import {BlockBindingSource, BlockProperty} from './BlockProperty';
import {DataMap} from '../util/DataTypes';

export class BlockBinding extends PropDispatcher implements PropListener, BlockBindingSource {
  private _block: Block;
  private _path: string;
  private _field: string;

  private _source: unknown = null;

  _parent: BlockBindingSource = null;

  private _prop: BlockProperty = null;

  constructor(block: Block, path: string, field: string) {
    super();
    this._block = block;
    this._path = path;
    this._field = field;
  }

  getProperty() {
    return this._prop;
  }

  unlisten(listener: PropListener<any>) {
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

  listen(listener: PropListener<any>) {
    this._listeners.add(listener);
    if (this._prop != null) {
      this._prop.listen(listener);
    } else if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  onSourceChange(source: PropDispatcher<any>) {
    // do nothing
  }

  onChange(val: unknown): unknown {
    if (Object.is(this._source, val)) {
      return;
    }
    this._source = val;
    if (val instanceof Block) {
      this._propChanged(val.getProperty(this._field));
    } else {
      this._propChanged(null);
      if (val && typeof val === 'object' && Object.hasOwn(val, this._field)) {
        // drill down into object children
        this.updateValue((val as DataMap)[this._field]);
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
      // set to this doesn't make much sense
      // it just forces the next updateValue to ignore current value
      this._value = this; // "this" doesn't make sense
    }
    return true;
  }

  destroy() {
    this._propChanged(null);
    if (this._parent) {
      this._parent.unlisten(this);
    }
    this._block._removeBinding(this._path);
    // can not set listeners to null here
    // destroy() might happen in the middle of _propChanged while listeners are still in use
    this._listeners.clear();
  }

  isDestroyed() {
    return this._block._destroyed;
  }
}
