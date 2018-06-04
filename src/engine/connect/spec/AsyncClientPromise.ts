import { ClientCallbacks } from "../ClientConnection";
import { DataMap } from "../../util/Types";

export class AsyncClientPromise implements ClientCallbacks {
  resolve: Function;
  reject: Function;

  promise: Promise<any>;

  constructor() {
    this._resetPromise();
  }

  cancel() {
    this.promise = null;
    this.reject = null;
    this.resolve = null;
  }

  _resetPromise() {
    this.promise = new Promise<any>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  onDone() {
    if (this.resolve) {
      this.resolve();
      this._resetPromise();
    }
  }

  onUpdate(response: DataMap) {
    if (this.resolve) {
      this.resolve(response);
      this._resetPromise();
    }
  }

  onError(error: string, data?: DataMap) {
    if (this.reject) {
      this.reject(error);
      this._resetPromise();
    }
  }
}