import {PropDispatcher, PropListener, Destroyable} from './Dispatcher';
import {Block} from './Block';
import {DataMap, isSavedBlock} from '../util/DataTypes';

export interface BlockBindingSource extends PropDispatcher<any>, Destroyable {
  getProperty(): BlockProperty;
}

export interface BlockPropertyEvent {
  error?: string;
  bind?: string | null;
  listener?: PropListener<any> | null;
}

export interface BlockPropertySubscriber {
  onPropertyEvent(change: BlockPropertyEvent): void;
}

export class BlockProperty extends PropDispatcher<any> implements PropListener<any>, BlockBindingSource {
  readonly _block: Block;
  readonly _name: string;
  _bindingPath: string;
  _bindingSource: BlockBindingSource;
  _helperProperty: HelperProperty;

  _saved: unknown;

  getName() {
    return this._name;
  }

  constructor(block: Block, name: string) {
    super();
    this._block = block;
    this._name = name;
  }

  getProperty() {
    return this;
  }

  onSourceChange(prop: PropDispatcher<any>) {
    // do nothing
  }

  _valueChanged(saved?: boolean) {
    // to be overridden
  }

  updateValue(val: unknown): boolean {
    return this.onChange(val);
  }

  revertUpdate() {
    let val: unknown;
    if (this._saved !== undefined) {
      val = this._saved;
    } else if (this._bindingSource) {
      val = this._bindingSource.getProperty()._value;
    } else {
      return;
    }
    if (!Object.is(this._value, val)) {
      this.onChange(val);
    }
  }

  onChange(val: unknown, save?: boolean): boolean {
    if (Object.is(this._value, val)) {
      if (save && !Object.is(this._saved, val)) {
        this._saved = val;
      }
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
  setOutput(val: unknown): boolean {
    return this.onChange(val);
  }

  setValue(val: unknown) {
    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
      if (this._helperProperty) {
        this._helperProperty.setValue(undefined);
        this._helperProperty = null;
      }
      this._bindingPath = null;
      this._bindingSource = null;
      if (this._subscribers) {
        this.addEvent({bind: null});
      }
    }
    this.onChange(val, true);
  }

  isCleared() {
    return this._bindingPath == null && this._saved === undefined;
  }

  getValue() {
    return this._value;
  }

  setBinding(path: string) {
    if (path === this._bindingPath) return;

    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
    }
    if (this._helperProperty) {
      this._helperProperty.setValue(undefined);
      this._helperProperty = null;
    }
    this._bindingPath = path;

    if (path != null) {
      this._saved = undefined;
      this._bindingSource = this._block.createBinding(path, this);
    } else {
      this._bindingSource = null;
      this.onChange(undefined, true);
    }
    if (this._subscribers) {
      this.addEvent({bind: path});
    }
  }

  _listenRaw(source: BlockBindingSource) {
    if (this._bindingSource) {
      if (source === this._bindingSource) {
        return;
      }
      this._bindingSource.unlisten(this);
      this._bindingPath = null;
    }
    this._bindingSource = source;
    source.listen(this);
  }

  setBindProperty(prop: HelperProperty) {
    this._helperProperty = prop;
  }

  _saveValue(): unknown {
    if (this._saved !== undefined) {
      if (this._saved instanceof Block) {
        return this._saved._save();
      }
      if (isSavedBlock(this._saved)) {
        // when saved object is ambiguous, wrapped it with another layer of #is:{}
        return {'#is': this._saved};
      }
      return this._saved;
    }
  }

  _saveBinding(): unknown {
    if (this._helperProperty) {
      return this._helperProperty.__save();
    }
    return this._bindingPath;
  }

  _saveToMap(map: DataMap) {
    if (this._bindingPath) {
      map[`~${this._name}`] = this._saveBinding();
    } else {
      let saved = this._saveValue();
      if (saved !== undefined) {
        map[this._name] = saved;
      }
    }
  }

  _load(val: unknown) {
    if (isSavedBlock(val)) {
      if (typeof val['#is'] === 'object') {
        // not a saved block, but a wrapped object
        this.onChange(val['#is'], true);
        return;
      }
      let block = this.createBlock(undefined);
      block._load(val);
      this.onChange(block, true);
    } else {
      this.onChange(val, true);
    }
  }

  _liveUpdate(val: unknown) {
    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
      this._bindingSource = null;
      this._bindingPath = null;
      if (this._subscribers) {
        this.addEvent({bind: null});
      }
    }
    if (isSavedBlock(val)) {
      if (typeof val['#is'] === 'object') {
        // not a saved block, but a wrapped object
        this.onChange(val['#is'], true);
        return;
      }
      if (this._saved instanceof Block) {
        this._saved._liveUpdate(val);
      } else {
        // just do a normal loading
        let block = this.createBlock(undefined);
        block._load(val);
        this.onChange(block, true);
      }
    } else if (val !== this._saved) {
      this.onChange(val, true);
    }
  }
  // clear saved value and binding path if they exist, otherwise leave runtime value unchanged
  _liveClear() {
    if (this._bindingPath || this._saved !== undefined) {
      this.setValue(undefined);
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

  listen(listener: PropListener<any>) {
    this._listeners.add(listener);
    listener?.onSourceChange(this);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
    if (this._subscribers) {
      this.addEvent({listener});
    }
  }

  unlisten(listener: PropListener<any>) {
    if (this._listeners) {
      this._listeners.delete(listener);
      if (this._subscribers) {
        this.addEvent({listener: null});
      }
    }
  }

  createBlock(save: boolean) {
    let block = new Block(this._block._flow, this._block, this);
    if (save) {
      this.setValue(block);
    } else if (save === false) {
      this.onChange(block);
    }
    // skip value change when save is undefined
    return block;
  }

  destroy() {
    if (!this._listeners) {
      return;
    }
    if (this._bindingSource) {
      this._bindingSource.unlisten(this);
      this._bindingSource = null;
    }
    if (this._value instanceof Block && this._value._prop === this) {
      this._value.destroy();
    }
    for (let listener of this._listeners) {
      listener?.onSourceChange(null);
    }
    this._listeners = null;
    this._subscribers = null;
    // TODO ?
  }

  isDestroyed() {
    return (
      this._block._destroyed || !this._listeners // maybe destroy is not called but block is in the middle of destroy()
    );
  }
}

export class BlockIO extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
    if (block._ioCache) {
      block._ioCache.set(name, this);
    }
  }

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
  setOutput(val: unknown): boolean {
    this._outputing = true;
    let changed = this.onChange(val);
    this._outputing = false;
    return changed;
  }
}

export class BlockConfig extends BlockProperty {
  _valueChanged(saved?: boolean) {
    if (!this._outputing) {
      this._block.configChanged(this, this._value);
    }
    if (this._block._watchers) {
      this._block._onChildChanged(this, saved);
    }
  }

  _outputing: boolean = false;

  // outputs the value but doesn't notify the function
  setOutput(val: unknown): boolean {
    this._outputing = true;
    let changed = this.onChange(val);
    this._outputing = false;
    return changed;
  }
}

export class ContextProperty extends BlockIO {
  constructor(block: Block, name: string) {
    super(block, name);
    this.listenToParentGlobal();
  }

  onChange(val: unknown, save?: boolean): boolean {
    if (super.onChange(val, save) && save) {
      this.checkInUse();
      return true;
    } else {
      return false;
    }
  }

  unlisten(listener: PropListener<any>) {
    super.unlisten(listener);
    this.checkInUse();
  }

  setBinding(path: string) {
    super.setBinding(path);
    this.checkInUse();
  }

  checkInUse() {
    if (this._saved === undefined && this._bindingPath == null) {
      if (this._listeners.size === 0) {
        this._block._props.delete(this._name);
        if (this._block._ioCache) {
          this._block._ioCache.delete(this._name);
        }
        this.destroy();
      } else {
        this.listenToParentGlobal();
      }
    }
  }

  listenToParentGlobal() {
    this._listenRaw(this._block._flow._parent._flow.getContextProperty(this._name));
  }
}

export class HelperProperty extends BlockProperty {
  // a helper block should only be saved from original property
  _saveValue(): unknown {
    return undefined;
  }

  // call the raw save function
  __save(): unknown {
    if (this._saved instanceof Block) {
      return this._saved._save();
    } else {
      return undefined;
    }
  }
}
