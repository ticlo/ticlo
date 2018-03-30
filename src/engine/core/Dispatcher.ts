export interface IListen {
  onChange(val: any): void;
}

export interface IDestroyable {
  destroy(): void;
}

export interface IDispatcher {
  listen(listener: IListen): void ;

  unlisten(listener: IListen): void;

  updateValue(val: any): boolean ;
}

export class ValueDispatcher implements IDispatcher {

  protected _listeners: Set<IListen> = new Set<IListen>();
  protected _updating = false;
  protected _value: any = null;

  listen(listener: IListen) {
    this._listeners.add(listener);
    if (!this._updating) {
      // skip extra update if it's already in updating iteration
      listener.onChange(this._value);
    }
  }

  unlisten(listener: IListen) {
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
