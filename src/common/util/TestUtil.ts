export function shouldReject(promise: Promise<any>): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    promise.then((val) => {
      /* istanbul ignore next */
      reject(val);
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
        reject(val);
      }, (err) => {
        /* istanbul ignore next */
        reject(err);
      }
    );
  });
}
