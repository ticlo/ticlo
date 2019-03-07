import {ClientCallbacks} from "../ClientConnection";
import {DataMap} from "../../util/Types";

export class AsyncClientPromise implements ClientCallbacks {
  resolve: Function;
  reject: Function;

  firstPromise: Promise<any>;
  promise: Promise<any>;

  constructor() {
    this._resetPromise();
    this.firstPromise = this.promise;
  }

  cancel() {
    this.promise = null;
    this.resolve = null;
    this.reject = null;
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

  lastResponse: DataMap;

  onUpdate(response: DataMap) {
    this.lastResponse = response;
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