import {DateTime} from 'luxon';

export function deepClone<T>(val: T): T {
  if (val != null && typeof val === 'object') {
    if (Array.isArray(val)) {
      const arr: any[] = [];
      for (const o of val) {
        arr.push(deepClone(o));
      }
      return arr as T;
    }
    if (val.constructor !== Object) {
      if (typeof (val as any).clone === 'function') {
        return (val as any).clone();
      }
      return val;
    }
    const obj: any = {};
    for (const k in val) {
      obj[k] = deepClone(val[k]);
    }
    return obj;
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
      const arr: any[] = [];
      for (const o of val) {
        arr.push(cloneToLevel(o, level));
      }
      return arr as T;
    }
    if (val.constructor !== Object) {
      if (typeof (val as any).clone === 'function') {
        return (val as any).clone();
      }
      return val;
    }
    const obj: any = {};
    for (const k in val) {
      obj[k] = cloneToLevel(val[k], level);
    }
    return obj;
  }
  return val;
}
