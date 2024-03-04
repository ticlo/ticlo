import {DataMap} from './DataTypes';

export function deepClone<T>(val: T): T {
  if (val != null && typeof val === 'object') {
    if (Array.isArray(val)) {
      let arr: any[] = [];
      for (let o of val) {
        arr.push(deepClone(o));
      }
      return arr as T;
    } else if (val instanceof Object) {
      let obj: any = {};
      for (let k in val) {
        obj[k] = deepClone(val[k]);
      }
      return obj;
    }
  }
  return val;
}

/**
 * @param val
 * @param level level=0 return val directly, level=1 shallow clone, level=2 clone to second layer children, etc...
 */
export function cloneToLevel<T>(val: T, level: number): T {
  if (level-- && val != null && typeof val === 'object') {
    if (Array.isArray(val)) {
      let arr: any[] = [];
      for (let o of val) {
        arr.push(cloneToLevel(o, level));
      }
      return arr as T;
    } else if (val instanceof Object) {
      let obj: any = {};
      for (let k in val) {
        obj[k] = cloneToLevel(val[k], level);
      }
      return obj;
    }
  }
  return val;
}
