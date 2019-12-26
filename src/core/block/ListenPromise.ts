import {ErrorEvent, Event, EventType} from './Event';
import {PropDispatcher, PropListener} from './Dispatcher';
import {BlockBindingSource} from './BlockProperty';

/// a helper class to use async await on Dispatcher
export class ListenPromise<T> implements PropListener<T> {
  // if source is set, it will be managed by the listener and unlistened automaticly
  _source: BlockBindingSource;
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

  onSourceChange(prop: PropDispatcher<T>): void {
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
    if (this._source) {
      this._source.unlisten(this);
    }
    this._valid = false;
  }
}
