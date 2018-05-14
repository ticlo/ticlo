export interface Listener<T> {
  onSourceChange(prop: Dispatcher<T>): void;

  onChange(val: T): void;
}

export interface Dispatcher<T> {
  listen(listener: Listener<T>): void;

  unlisten(listener: Listener<T>): void;

  updateValue(val: T): boolean;
}

export class ValueDispatcher<T> implements Dispatcher<T> {

  protected _listeners: Set<Listener<T>> = new Set<Listener<T>>();
  protected _updating = false;
  _value: T;

  listen(listener: Listener<T>) {
    this._listeners.add(listener);
    listener.onSourceChange(this);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  unlisten(listener: Listener<T>) {
    this._listeners.delete(listener);
  }

  updateValue(val: T): boolean {
    if (this._value === val) {
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
