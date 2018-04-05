export interface Listener {
  onChange(val: any): void;
}

export interface Dispatcher {
  listen(listener: Listener): void ;

  unlisten(listener: Listener): void;

  updateValue(val: any): boolean ;
}

export class ValueDispatcher implements Dispatcher {

  protected _listeners: Set<Listener> = new Set<Listener>();
  protected _updating = false;
  _value: any = null;

  listen(listener: Listener) {
    this._listeners.add(listener);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  unlisten(listener: Listener) {
    this._listeners.delete(listener);
  }

  updateValue(val: any): boolean {
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
