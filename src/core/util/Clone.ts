export function deepClone(val: any): any {
  if (val && typeof val === 'object') {
    if (Array.isArray(val)) {
      let arr: any[] = [];
      for (let o of val) {
        arr.push(deepClone(o));
      }
      return arr;
    } else if (val instanceof Object) {
      let obj: any = {};
      for (let k in val) {
        obj[k] = deepClone(val);
      }
      return obj;
    }
  }
  return val;
}
