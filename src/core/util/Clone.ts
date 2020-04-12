import {DataMap} from './DataTypes';

export function deepClone(val: any): any {
  if (val != null && typeof val === 'object') {
    if (Array.isArray(val)) {
      let arr: any[] = [];
      for (let o of val) {
        arr.push(deepClone(o));
      }
      return arr;
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
 * @param level, level=0 return val directly, level=1 shallow clone, level=2 clone to second layer children, etc...
 */
export function cloneToLevel(val: any, level: number): DataMap {
  if (level-- && val != null && typeof val === 'object') {
    if (Array.isArray(val)) {
      let arr: any[] = [];
      for (let o of val) {
        arr.push(cloneToLevel(o, level));
      }
      return arr;
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
