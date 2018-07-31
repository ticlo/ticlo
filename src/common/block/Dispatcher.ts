import {Event, ErrorEvent, EventType} from "./Event";

export interface Listener<T> {
  onSourceChange(prop: Dispatcher<T>): void;

  onChange(val: T): void;
}

export interface Dispatcher<T> {
  listen(listener: Listener<T>): void;

  unlisten(listener: Listener<T>): void;

  updateValue(val: T): boolean;
}

export interface Destroyable {
  destroy(): void;
  isDestroyed(): boolean;
}

export abstract class ValueDispatcher<T> implements Dispatcher<T> {

  _listeners: Set<Listener<T>> = new Set<Listener<T>>();
  _updating = false;
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


/// a helper class to use async await on Dispatcher
export class ListenPromise<T> implements Listener<T> {

  // if source is set, it will be managed by the listener and unlistened automaticly
  _source: ValueDispatcher<T> & Destroyable;
  _valid = false;
  _promise: Promise<T>;
  _validator?: (val: T) => EventType | boolean;
  _resolve: (value?: T | PromiseLike<T>) => void;
  _reject: (reason?: any) => void;

  constructor(validator?: (val: T) => EventType | boolean) {
    this._validator = validator;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  onSourceChange(prop: Dispatcher<T>): void {
    if (this._valid && prop == null) {
      if (!this._source || this._source.isDestroyed()) {
        // if source is destroyed, reject the promise
        this._reject(new ErrorEvent('value source disappear'));
        this.destroy();
      }
    }
  }

  onChange(val: T): void {
    if (this._valid) {
      let result: EventType | boolean;
      if (this._validator) {
        result = this._validator(val);
      } else {
        result = Event.check(val);
      }
      switch (result) {
        case true:
        case EventType.TRIGGER: {
          this._resolve(val);
          this.destroy();
          return;
        }
        case EventType.ERROR: {
          this._reject(val);
          this.destroy();
          return;
        }
      }
    }
  }
  destroy() {
    if (this._valid) {
      if (this._source) {
        this._source.unlisten(this);
      }
      this._valid = false;
    }
  }
}

