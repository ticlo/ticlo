import {DataMap, isBaseObject, TRUNCATED} from './DataTypes.ts';
import {decode, decodeReviver, encodeRaw} from './Serialize.ts';
import QS from 'qs';
import {DateTime} from 'luxon';

function truncateMap(val: DataMap, maxSize: number): [any, number, boolean] {
  let total = 0;
  let truncated = false;
  const result: DataMap = {};
  for (const key in val) {
    const fieldSize = key.length + 1;
    if (total + fieldSize >= maxSize) {
      result[TRUNCATED] = 1;
      return [result, total, true];
    }
    const [t, size, trunc] = truncateObj(val[key], (maxSize - total - fieldSize) * 0.75);
    result[key] = t;
    total += size + fieldSize;
    if (trunc) {
      truncated = true;
    }
  }
  return [result, total, truncated];
}

function truncateArray(val: any[], maxSize: number): [any[], number, boolean] {
  let total = 0;
  let truncated = false;
  const result: any[] = [];

  for (let i = 0; i < val.length; ++i) {
    if (total >= maxSize) {
      result.push(TRUNCATED, val.length);
      return [result, total + TRUNCATED.length + String(val.length).length + 2, true];
    }
    const [t, size, trunc] = truncateObj(val[i], Math.max(0, maxSize - total - 1) * 0.75);
    total += size + 1;
    result.push(t);
    if (trunc) {
      truncated = true;
    }
  }
  if (truncated) {
    result.push(TRUNCATED, val.length);
    total += TRUNCATED.length + String(val.length).length + 2;
  }
  return [result, total, truncated];
}

function truncateObj(val: any, maxSize: number): [any, number, boolean] {
  if (typeof val === 'object') {
    if (val == null) {
      return [val, 4, false];
    }
    if (Array.isArray(val)) {
      return truncateArray(val, maxSize);
    }
    if (DateTime.isDateTime(val)) {
      return [val, 33, false];
    }
    if (isBaseObject(val)) {
      return truncateMap(val, maxSize);
    }
    const encoded = encodeRaw(val);
    if (typeof encoded === 'string' && encoded.length <= maxSize) {
      // Keep preview values usable without decoding the whole transport frame.
      return [decodeReviver('', encoded), encoded.length, false];
    }
    // TODO binary ?
    return [TRUNCATED, 4, true];
  } else if (typeof val === 'string') {
    if (val.length > maxSize / 2) {
      const preview = val.substring(0, Math.floor(maxSize / 8)) + TRUNCATED;
      return [preview, preview.length, true];
    }
    return [val, val.length, false];
  } else {
    return [val, 4, false];
  }
}

export function truncateData(val: any, maxSize: number = 1024): [any, number] {
  if (maxSize === Infinity) {
    return [val, 1];
  }
  const [result, total, truncated] = truncateObj(val, maxSize);
  if (truncated) {
    if (!Array.isArray(result) && result.constructor === Object) {
      if (!result[TRUNCATED]) {
        result[TRUNCATED] = 1;
      }
    }
  }
  return [result, total];
}

// convert input to output object
export function convertToObject(val: any): {[key: string]: any} {
  switch (typeof val) {
    case 'object':
      if (val) {
        return val;
      }
      break;
    case 'string':
      try {
        if (val.startsWith('{')) {
          return decode(val);
        } else {
          return QS.parse(val);
        }
      } catch (e) {}
  }
  return {};
}
