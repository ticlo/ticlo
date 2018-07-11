import {ValueDispatcher, Listener, Dispatcher} from "./Dispatcher";
import {Block, BlockChildWatch} from "./Block";
import {isSavedBlock} from "../util/Types";

export interface BlockPropertyEvent {
  error?: string;
  bind?: string | null;
}

export interface BlockPropertySubscriber {
  onPropertyEvent(change: BlockPropertyEvent): void;
}

export class BlockProperty extends ValueDispatcher<any> implements Listener<any> {

  _block: Block;
  _name: string;
  _bindingPath: string;
  _bindingSource: ValueDispatcher<any>;

  _saved: any;

  constructor(block: Block, name: string) {
    super();
    this._block = block;
    this._name = name;
  }

  onSourceChange(prop: Dispatcher<any>) {
    // do nothing
  }

  _valueChanged(saved?: boolean) {
    // to be overridden
  }

  updateValue(val: any): boolean {
    return this.onChange(val);
  }

  onChange(val: any, save?: boolean): boolean {
    if (Object.is(this._value, val)) {
      return false;
    }
    if (this._value instanceof Block) {
      if (this._value._prop === this) {
        this._value.destroy();
      }
      if (this._saved === this._value) {
        this._saved = undefined;
      }
    }
    this._value = val;
    if (save) {
      this._saved = val;
    }
    this._valueChanged(save);
    this._dispatch();
    return true;
  }

  // output the value but doesn't notify the function
  // to be overriden in BlockIo
  setOutput(val: any): boolean {
    return this.onChange(val);
  }


  setValue(val: any) {
    if (this._bindingPath) {
      if (this._bindingSource) {
        this._bindingSource.unlisten(this);
      }
      this._bindingPath = null;
      this._bindingSource = null;
      if (this._subscribers) {
        this.addEvent({bind: null});
      }
    }
    this.onChange(val, true);
  }

  // clear saved value and binding path
  clear() {
    if (this._bindingPath || this._saved) {
      this.setValue(undefined);
    }
  }

  getValue() {
    return this._value;
  }

  setBinding(path: string) {
    if (path === this._bindingPath) return;

    if (this._bindingSource != null) {
      this._bindingSource.unlisten(this);
    }
    this._bindingPath = path;

    if (path != null) {
      this._bindingSource = this._block.createBinding(path, this);
      this._saved = undefined;
    } else {
      this._bindingSource = null;
      this.onChange(undefined, true);
    }
    if (this._subscribers) {
      this.addEvent({bind: path});
    }
  }

  _save(): any {
    if (this._saved !== undefined) {
      if (this._saved instanceof Block) {
        return this._saved._save();
      }
      if (isSavedBlock(this._saved)) {
        return {'#is': this._saved};
      }
      return this._saved;
    }
  }

  _load(val: any) {
    if (isSavedBlock(val)) {
      if (typeof val['#is'] === 'object') {
        this.onChange(val['#is'], true);
        return;
      }
      let block = new Block(this._block._job, this._block, this);
      block._load(val);
      this.onChange(block, true);
    } else {
      this.onChange(val, true);
    }
  }

  _liveUpdate(val: any) {
    if (this._bindingPath != null) {
      // clear binding
      if (this._bindingSource) {
        this._bindingSource.unlisten(this);
      }
      this._bindingSource = null;
      this._bindingPath = null;
      if (this._subscribers) {
        this.addEvent({bind: null});
      }
    }
    if (isSavedBlock(val)) {
      if (typeof val['#is'] === 'object') {
        this.onChange(val['#is'], true);
        return;
      }
      if (this._saved instanceof Block) {
        this._saved._liveUpdate(val);
      } else {
        // just do a normal loading
        let block = new Block(this._block._job, this._block, this);
        block._load(val);
        this.onChange(block, true);
      }
    } else if (val !== this._saved) {
      this.onChange(val, true);
    }
  }

  _subscribers: Set<BlockPropertySubscriber>;

  subscribe(subscriber: BlockPropertySubscriber) {
    if (this._subscribers == null) {
      this._subscribers = new Set<BlockPropertySubscriber>();
    }
    this._subscribers.add(subscriber);
  }

  unsubscribe(subscriber: BlockPropertySubscriber) {
    if (!this._subscribers) {
      return;
    }
    this._subscribers.delete(subscriber);
    if (this._subscribers.size === 0) {
      this._subscribers = null;
    }
  }

  addEvent(event: BlockPropertyEvent) {
    for (let subscriber of this._subscribers) {
      subscriber.onPropertyEvent(event);
    }
  }

  unlisten(listener: Listener<any>) {
    if (this._listeners) {
      this._listeners.delete(listener);
    }
  }

  destroy() {
    if (this._bindingSource != null) {
      this._bindingSource.unlisten(this);
      this._bindingSource = null;
    }
    if (this._value instanceof Block && this._value._prop === this) {
      this._value.destroy();
    }
    for (let listener of this._listeners) {
      listener.onSourceChange(null);
    }
    this._listeners = null;
    this._subscribers = null;
    // TODO ?
  }
}

export class BlockIO extends BlockProperty {
  _valueChanged(saved?: boolean) {
    if (!this._outputing) {
      this._block.inputChanged(this, this._value);
    }
    if (this._block._watchers) {
      this._block._onChildChanged(this, saved);
    }
  }

  _outputing: boolean = false;

  // outputs the value but doesn't notify the function
  setOutput(val: any): boolean {
    this._outputing = true;
    let changed = this.onChange(val);
    this._outputing = false;
    return changed;
  }
}

// holds helper function that output to another property of its owner
// property name is `!${relatedPropertyName}`
export class BlockPropertyHelper extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }
}
