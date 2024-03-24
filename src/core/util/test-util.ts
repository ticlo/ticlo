import {ErrorEvent} from '../block/Event';

export function shouldReject(promise: Promise<any>): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    promise
      .then((val) => {
        /* istanbul ignore next */
        reject(new ErrorEvent('not rejected', val));
      })
      .catch((err) => {
        resolve(err);
      });
  });
}

export function shouldTimeout(promise: Promise<any>, ms: number): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => resolve(null), ms);
    promise.then(
      (val) => {
        /* istanbul ignore next */
        reject(new ErrorEvent('not timeout', val));
      },
      (err) => {
        /* istanbul ignore next */
        reject(err);
      }
    );
  });
}

export function shouldHappen(callback: () => any, timeoutMs: number = 500, errorMsg: string = 'timeout'): Promise<any> {
  // prepare a Error first to maintain the original call stack
  let error = new Error(errorMsg);

  let beginTime = new Date().getTime();
  return new Promise<any>((resolve, reject) => {
    let onTimer = () => {
      let result = callback();
      if (result) {
        resolve(result);
        return;
      }
      let currentTime = new Date().getTime();
      if (currentTime - beginTime > timeoutMs) {
        reject(error);
      } else {
        setTimeout(onTimer, 1);
      }
    };
    onTimer();
  });
}

export function waitTick(ms = 0): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

function voidFunction(): void {
  //
}

export const dummyInterface = new Proxy(
  {},
  {
    get() {
      return voidFunction;
    },
  }
);
