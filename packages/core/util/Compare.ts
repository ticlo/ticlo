import {isDateSame} from './DateTime.js';
import {DateTime} from 'luxon';

export function arrayEqual(a1: any[], a2: any[]) {
  if (a1.length !== a2.length) {
    return false;
  }
  for (let i = 0; i < a1.length; ++i) {
    if (a1[i] !== a2[i]) {
      return false;
    }
  }
  return true;
}

const isArray = Array.isArray;
const keyList = Object.keys;

// used to check of something has changed. so NaN should equal to NaN and invalid date should equal to invalid date
function _deepEqual(a: any, b: any, map: Map<unknown, unknown>) {
  if (Object.is(a, b)) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const Cls = a.constructor;
    const Clsb = b.constructor;
    if (Cls !== Clsb) {
      return false;
    }
    if (map.has(a)) {
      return map.get(a) === b;
    }
    map.set(a, b);

    if (isArray(a)) {
      const length = a.length;
      if (length !== b.length) return false;
      for (let i = length - 1; i >= 0; --i) {
        if (!_deepEqual(a[i], b[i], map)) return false;
      }
      return true;
    }

    switch (Cls) {
      case Object: {
        const keys = keyList(a);
        if (keys.length !== keyList(b).length) {
          return false;
        }

        for (const key of keys) {
          if (!_deepEqual(a[key], b[key], map)) {
            return false;
          }
        }
        return true;
      }
      case DateTime: {
        // Make sure invalid dayjs is equal to invalid dayjs
        return isDateSame(a as DateTime, b as DateTime);
      }
      // TODO compare Map and Set ?
      default: {
        // default compare with shallow equal
        const keys = keyList(a);
        if (keys.length !== keyList(b).length) {
          return false;
        }

        for (const key of keys) {
          if (!Object.is(a[key], b[key])) return false;
        }
        return true;
      }
    }
  }
  return false;
}
export function deepEqual(a: any, b: any) {
  return _deepEqual(a, b, new Map<unknown, unknown>());
}
export function isValueEqual(a: any, b: any) {
  if (Object.is(a, b)) {
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && a.constructor === b.constructor) {
    if (a.constructor === DateTime) {
      return isDateSame(a as DateTime, b as DateTime);
    }
  }
  return false;
}

export function shallowEqual(a: any, b: any) {
  if (isValueEqual(a, b)) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const arrA = isArray(a);
    const arrB = isArray(b);

    if (arrA && arrB) {
      const length = a.length;
      if (length !== b.length) return false;
      for (let i = length - 1; i >= 0; --i) {
        if (!isValueEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (arrA !== arrB) return false;

    const keys = keyList(a);

    if (keys.length !== keyList(b).length) {
      return false;
    }

    for (const key of keys) {
      if (!isValueEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
  return false;
}
