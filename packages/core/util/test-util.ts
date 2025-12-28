export function shouldReject(promise: Promise<any>): Promise<any> {
  const error = new Error('not rejected');
  return new Promise<any>((resolve, reject) => {
    promise
      .then((val) => {
        /* istanbul ignore next */
        reject(error);
      })
      .catch((err) => {
        resolve(err);
      });
  });
}

export function shouldTimeout(promise: Promise<any>, ms: number): Promise<any> {
  const error = new Error('not timeout');
  return new Promise<any>((resolve, reject) => {
    setTimeout(() => resolve(null), ms);
    promise.then(
      (val) => {
        /* istanbul ignore next */
        reject(error);
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
  const error = new Error(errorMsg);

  const beginTime = new Date().getTime();
  return new Promise<any>((resolve, reject) => {
    const onTimer = () => {
      const result = callback();
      if (result) {
        resolve(result);
        return;
      }
      const currentTime = new Date().getTime();
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

export class CallbackLogger {
  logs: unknown[] = [];
  log = (data: unknown) => {
    this.logs.push(data);
  };
  clear() {
    this.logs.length = 0;
  }
}
