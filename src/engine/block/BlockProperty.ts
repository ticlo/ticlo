import { ValueDispatcher, Listener, Dispatcher } from "./Dispatcher";
import { Block, BlockChildWatch } from "./Block";
import { isSavedBlock } from "../util/Types";

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

  _saved: any = null;

  constructor(block: Block, name: string) {
    super();
    this._block = block;
    this._name = name;
  }

  onSourceChange(prop: Dispatcher<any>) {
    // do nothing
  }

  _valueChanged() {
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
      if (this._saved === this._value) {
        this._saved = null;
      }
      this._block.onChildRemoved(this._name);
    }
    this._value = val;
    this._valueChanged();
    this._dispatch();
    return true;
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
    if (val !== this._saved) {
      this._saved = val;
    }
    this.onChange(val);
  }

  // clear saved value and binding path
  clear() {
    if (this._bindingPath || this._saved) {
      this.setValue(null);
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
    this._saved = null;
    this._bindingPath = path;

    if (path != null) {
      this._bindingSource = this._block.createBinding(path, this);
    } else {
      this._bindingSource = null;
      this.onChange(null);
    }
    if (this._subscribers) {
      this.addEvent({bind: path});
    }
  }

  _save(): any {
    if (this._saved != null) {
      if (this._saved instanceof Block) {
        return this._saved._save();
      }
      return this._saved;
    }
  }

  _load(val: any) {
    if (val instanceof Object && val != null
      && (val.hasOwnProperty('#is') || val.hasOwnProperty('~#is'))) {
      let block = new Block(this._block._job, this._block, this);
      this._saved = block;
      block._load(val);
      this.onChange(block);
    } else {
      this._saved = val;
      this.onChange(val);
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
      if (this._saved instanceof Block) {
        this._saved._liveUpdate(val);
      } else {
        // just do a normal loading
        let block = new Block(this._block._job, this._block, this);
        this._saved = block;
        block._load(val);
        this.onChange(block);
      }
    } else if (val !== this._saved) {
      this._saved = val;
      this.onChange(val);
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
  constructor(block: Block, name: string) {
    super(block, name);
  }

  _valueChanged() {
    this._block.inputChanged(this, this._value);
  }
}

// holds helper function that output to another property of its owner
// property name is `!${relatedPropertyName}`
export class BlockPropertyHelper extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }
}