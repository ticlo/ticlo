import { ClientCallbacks } from "../ClientConnection";
import { DataMap } from "../../util/Types";

export class AsyncClientPromise implements ClientCallbacks {
  resolve: Function;

  firstPromise: Promise<any>;
  promise: Promise<any>;

  constructor() {
    this._resetPromise();
    this.firstPromise = this.promise;
  }

  cancel() {
    this.promise = null;
    this.resolve = null;
  }

  _resetPromise() {
    this.promise = new Promise<any>((resolve, reject) => {
      this.resolve = resolve;
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
    if (this.resolve) {
      this.resolve(new Error(error));
      this._resetPromise();
    }
  }
}