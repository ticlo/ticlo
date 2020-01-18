export interface PropListener<T = any> {
  onSourceChange?(prop: PropDispatcher<T>): void;

  onChange(val: T): void;
}

export interface Destroyable {
  destroy(): void;

  isDestroyed(): boolean;
}

export class PropDispatcher<T = any> {
  _listeners: Set<PropListener<T>> = new Set<PropListener<T>>();
  _updating = false;
  _value: T;

  listen(listener: PropListener<T>) {
    this._listeners.add(listener);

    listener.onSourceChange(this);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  unlisten(listener: PropListener<T>) {
    this._listeners.delete(listener);
  }

  updateValue(val: T): boolean {
    if (Object.is(this._value, val)) {
      return false;
    }
    this._value = val;
    this._dispatch();
    return true;
  }

  protected _dispatch(): void {
    this._updating = true;
    for (let listener of this._listeners) {
      listener.onChange(this._value);
    }
    this._updating = false;
  }
}

export class StreamDispatcher<T = any> {
  _listeners: Set<(val: T) => void> = new Set<(val: T) => void>();

  listen(listener: (val: T) => void) {
    this._listeners.add(listener);
  }

  unlisten(listener: (val: T) => void) {
    this._listeners.delete(listener);
  }

  dispatch(value: T): void {
    for (let listener of this._listeners) {
      listener(value);
    }
  }
}
