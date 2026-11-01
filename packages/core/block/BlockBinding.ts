import {PropDispatcher, PropListener} from './Dispatcher.ts';
import {Block} from './Block.ts';
import {BlockBindingSource, BlockProperty} from './BlockProperty.ts';
import {DataMap} from '../util/DataTypes.ts';

// Represents one segment of a dotted binding path. Each segment listens to its
// parent segment, then either follows a Block property or drills into a plain
// object field before dispatching the resolved value to its listeners.
export class BlockBinding extends PropDispatcher implements PropListener, BlockBindingSource {
  private _block: Block;
  private _path: string;
  private _field: string;

  // REFACTOR(design.md): MUST replace cached upstream values with transient delivery routing through explicit wires.
  private _source: unknown = null;

  _parent: BlockBindingSource = null;

  // REFACTOR(design.md): MUST bind to a stable source port ID rather than resolving a path as the wire identity.
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

  // REFACTOR(design.md): MUST deliver each event without retaining a latest source payload.
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

  // REFACTOR(design.md): MUST preserve wire identity and order when its endpoint is reconnected.
  private _propChanged(prop: BlockProperty): boolean {
    if (prop === this._prop) return false;
    if (this._prop) {
      for (const listener of this._listeners) {
        this._prop.unlisten(listener);
        listener.onSourceChange(null);
      }
    }
    this._prop = prop;
    if (this._prop) {
      this._value = undefined;
      for (const listener of this._listeners) {
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
