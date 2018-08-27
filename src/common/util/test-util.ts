import {ErrorEvent} from "../block/Event";

export function shouldReject(promise: Promise<any>): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    promise.then((val) => {
      /* istanbul ignore next */
      reject(new ErrorEvent('not rejected', val));
    }).catch((err) => {
      resolve(err);
    });
  });
}

export function shouldTimeout(promise: Promise<any>, ms: number): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => resolve(), ms);
    promise.then((val) => {
        /* istanbul ignore next */
        reject(new ErrorEvent('not timeout', val));
      }, (err) => {
        /* istanbul ignore next */
        reject(err);
      }
    );
  });
}

export function shouldHappen(callback: () => any, timeoutMs: number = 100): Promise<any> {
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
        reject(new ErrorEvent('timeout'));
      } else {
        setTimeout(onTimer, 0);
      }
    };
    setTimeout(onTimer, 0);
  });
}

export function waitTick(): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    setTimeout(resolve, 0);
  });
}