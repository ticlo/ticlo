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

export function deepEqual(a: any, b: any) {
  if (Object.is(a, b)) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let arrA = isArray(a);
    let arrB = isArray(b);

    if (arrA && arrB) {
      let length = a.length;
      if (length !== b.length) return false;
      for (let i = length - 1; i >= 0; --i) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (arrA !== arrB) return false;

    let keys = keyList(a);

    if (keys.length !== keyList(b).length) {
      return false;
    }

    for (let key of keys) {
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
  return false;
}

export function shallowEqual(a: any, b: any) {
  if (Object.is(a, b)) {
    return true;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    let arrA = isArray(a);
    let arrB = isArray(b);

    if (arrA && arrB) {
      let length = a.length;
      if (length !== b.length) return false;
      for (let i = length - 1; i >= 0; --i) {
        if (!Object.is(a[i], b[i])) return false;
      }
      return true;
    }

    if (arrA !== arrB) return false;

    let keys = keyList(a);

    if (keys.length !== keyList(b).length) {
      return false;
    }

    for (let key of keys) {
      if (!Object.is(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }
  return false;
}
