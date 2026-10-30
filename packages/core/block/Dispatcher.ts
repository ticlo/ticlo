import {DataMap} from '../util/DataTypes.ts';

export interface PropListener<T = any> {
  onSourceChange?(prop: PropDispatcher<T>): void;

  onChange(val: T): void;
}

export interface Destroyable {
  destroy(): void;

  isDestroyed(): boolean;
}

export class PropDispatcher<T = unknown> {
  _listeners: Set<PropListener<T>> = new Set<PropListener<T>>();
  _updating = false;
  // REFACTOR(design.md): MUST NOT retain transient input or output deliveries as an implicit latest value.
  _value: T;

  getValue(): T {
    return this._value;
  }

  // REFACTOR(design.md): New wire listeners MUST NOT receive a previously delivered transient event.
  listen(listener: PropListener<T>) {
    this._listeners.add(listener);

    listener.onSourceChange?.(this);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  unlisten(listener: PropListener<T>) {
    this._listeners.delete(listener);
  }

  // REFACTOR(design.md): MUST dispatch through ordered wires and release the delivery after listeners consume it.
  updateValue(val: T): boolean {
    if (Object.is(this._value, val)) {
      return false;
    }
    this._value = val;
    this._dispatch();
    return true;
  }

  // REFACTOR(design.md): MUST replace listener insertion order with each wire's persisted execution order.
  protected _dispatch(): void {
    this._updating = true;
    for (const listener of this._listeners) {
      listener.onChange(this._value);
    }
    this._updating = false;
  }
}

export class StreamDispatcher<T = any> {
  _listeners: Set<(val: T) => void> = new Set<(val: T) => void>();

  #value: T = undefined;
  get value() {
    return this.#value;
  }

  listen(listener: (val: T) => void) {
    this._listeners.add(listener);
  }

  unlisten(listener: (val: T) => void) {
    this._listeners.delete(listener);
  }

  load(listener: (val: T) => void) {
    if (this.#value !== undefined) {
      listener(this.#value);
      return;
    }
    const tempListener = (val: T) => {
      listener(val);
      this.unlisten(tempListener);
    };
    this._listeners.add(tempListener);
  }

  dispatch(value: T): void {
    if (Object.is(value, this.#value)) {
      return;
    }
    this.#value = value;
    for (const listener of this._listeners) {
      listener(value);
    }
  }

  isEmpty() {
    return this._listeners.size === 0;
  }
}
