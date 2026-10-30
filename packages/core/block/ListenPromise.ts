import {ErrorEvent, Event, EventType} from './Event.ts';
import {PropDispatcher, PropListener} from './Dispatcher.ts';
import {BlockBindingSource} from './BlockProperty.ts';

/// a helper class to use async await on Dispatcher
export class ListenPromise<T> implements PropListener<T> {
  // if source is set, it will be managed by the listener and unlistened automaticly
  // REFACTOR(design.md): MUST tie this listener to a wire's lifetime and cancel it when the wire is removed.
  _source: BlockBindingSource;
  _valid = false;
  _promise: Promise<T>;
  _validator?: (val: T) => EventType | boolean;
  _resolve: (value?: T | PromiseLike<T>) => void;
  _reject: (reason?: unknown) => void;

  constructor(validator?: (val: T) => EventType | boolean) {
    this._validator = validator;
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  onSourceChange(prop: PropDispatcher<T>): void {
    if (this._valid && prop == null) {
      if (!this._source || this._source.isDestroyed()) {
        // if source is destroyed, reject the promise
        this._reject(new ErrorEvent('value source disappear'));
        this.destroy();
      }
    }
  }

  // REFACTOR(design.md): MUST consume one delivery without keeping its payload beyond resolution.
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

  // REFACTOR(design.md): MUST detach the listener and release references to pending event data.
  destroy() {
    if (this._source) {
      this._source.unlisten(this);
    }
    this._valid = false;
  }
}
