import {isMoment} from 'moment';
import QS from 'qs';
import {Block} from '../block/Block';
import {BlockIO} from '../block/BlockProperty';

export interface DataMap {
  [key: string]: any;
}

export const TRUNCATED = '·∙·'; // '\u00b7\u2219\u00b7'

export function isPrimitiveType(val: any) {
  if (val == null) {
    return true;
  }
  switch (typeof val) {
    case 'number':
    case 'string':
    case 'boolean':
      // case 'bigint':
      return true;
    default:
      return false;
  }
}

export function isSavedBlock(val: any): boolean {
  return Object.isExtensible(val) && (val.hasOwnProperty('#is') || val.hasOwnProperty('~#is'));
}

export function isDataTruncated(val: any): boolean {
  if (val == null) {
    return false;
  }
  if (typeof val === 'string') {
    return val.endsWith(TRUNCATED);
  }
  if (Array.isArray(val)) {
    return val.length > 0 && val.at(-1) === TRUNCATED;
  }
  if (val.constructor === Object) {
    return Boolean(val[TRUNCATED]);
  }
  return false;
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

// convert block to Object, used to convert worker #outputs block
export function convertToOutput(val: any, recursive: boolean = false): any {
  if (val instanceof Block) {
    let overrideValue = val.getValue('#value');
    if (overrideValue !== undefined) {
      return overrideValue;
    }
    let result: any = {};
    val.forEach((field: string, prop: BlockIO) => {
      if (recursive && prop._value instanceof Block) {
        if (prop._saved === prop._value) {
          result[field] = convertToOutput(prop._value, true);
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
