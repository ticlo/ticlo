import {Block} from "../block/Block";
import {BlockIO} from "../block/BlockProperty";

export interface DataMap {
  [key: string]: any;
}

export const TRUNCATED = '·∙·'; // '\u00b7\u2219\u00b7'

export function isSavedBlock(val: any): boolean {
  return Object.isExtensible(val) && (val.hasOwnProperty('#is') || val.hasOwnProperty('~#is'));
}

function truncateMap(val: DataMap, maxSize: number): [any, number] {
  let total = 0;
  let result: DataMap = {};
  let count = 0;
  for (let key in val) {
    ++count;
    if (total >= maxSize || count > 9) {
      if (count < 5) {
        result[key] = TRUNCATED;
        continue;
      }
      result[TRUNCATED] = TRUNCATED;
      return [result, total];
    }
    let [t, size] = truncateObj(val[key], (maxSize - total) * 0.75);
    result[key] = t;
    total += size + key.length;

  }
  return [result, total];
}

function truncateArray(val: any[], maxSize: number): [any[], number] {
  let total = 0;
  let result: any[] = [];

  for (let i = 0; i < val.length; ++i) {
    if (total >= maxSize || i > 8) {
      result.push(TRUNCATED);
      return [result, total];
    }
    let [t, size] = truncateObj(val[i], (maxSize - total) * 0.75);
    total += size;
    result.push(t);
  }
  return [result, total];
}

// if object is big, truncated it into around 1K~2K characters
export function truncateObj(val: any, maxSize: number = 1024): [any, number] {
  if (typeof val === 'object') {
    if (val == null) {
      return [val, 4];
    }
    if (Array.isArray(val)) {
      return truncateArray(val, maxSize);
    }
    if (val.constructor === Object) {
      return truncateMap(val, maxSize);
    }
    // TODO moment and binary
    return [TRUNCATED, 4];
  } else if (typeof val === 'string') {
    if (val.length > maxSize / 2) {
      if (maxSize > 256) {
        return [`${val.substr(0, 128)}${TRUNCATED}`, 128];
      } else {
        return [`${val.substr(0, 8)}${TRUNCATED}`, 8];
      }
    }
    return [val, val.length];
  } else {
    return [val, 4];
  }
}

function measureMap(val: DataMap, maxSize: number): number {
  let total = 0;
  for (let key in val) {
    total += measureObjSize(val[key], maxSize);
    total += key.length;
    if (total >= maxSize) {
      return total;
    }
  }
  return total;
}

function measureArray(arr: any[], maxSize: number): number {
  let total = 0;
  for (let v of arr) {
    total += measureObjSize(v);
    if (total >= maxSize) {
      return total;
    }
  }
  return total;
}

// if object is big, measured it into around 1K~2K characters
export function measureObjSize(val: any, maxSize: number = 1024): number {
  if (typeof val === 'object') {
    if (val == null) {
      return 4;
    }
    if (Array.isArray(val)) {
      return measureArray(val, maxSize);
    }
    if (val.constructor === Object) {
      return measureMap(val, maxSize);
    }
    // TODO moment and binary
  } else if (typeof val === 'string') {
    return val.length;
  }
  return 4;

}

// convert block to Object, used in MapFunction output
export function convertToObject(val: any, recursive: boolean = false): any {
  if (val instanceof Block) {
    let result: any = {};
    val.forEach((field: string, prop: BlockIO) => {
      if (recursive && prop._value instanceof Block) {
        if (prop._saved === prop._value) {
          result[field] = convertToObject(prop._value, true);
        } else {
          result[field] = null;
        }
      } else {
        result[field] = prop._value;
      }
    });
    return result;
  }
  return val;
}
