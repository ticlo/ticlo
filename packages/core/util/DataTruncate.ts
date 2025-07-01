import {DataMap, isBaseObject, TRUNCATED} from './DataTypes';
import {decode, encodeRaw} from './Serialize';
import QS from 'qs';
import {DateTime} from 'luxon';

function truncateMap(val: DataMap, maxSize: number): [any, number, boolean] {
  let total = 0;
  let truncated = false;
  let result: DataMap = {};
  let count = 0;
  for (let key in val) {
    ++count;
    if (total >= maxSize || count > 9) {
      if (count < 5) {
        result[key] = TRUNCATED;
        continue;
      }
      result[TRUNCATED] = 1;
      return [result, total, true];
    }
    let [t, size, trunc] = truncateObj(val[key], (maxSize - total) * 0.75);
    result[key] = t;
    total += size + key.length;
    if (trunc) {
      truncated = true;
    }
  }
  return [result, total, truncated];
}

function truncateArray(val: any[], maxSize: number): [any[], number, boolean] {
  let total = 0;
  let truncated = false;
  let result: any[] = [];

  for (let i = 0; i < val.length; ++i) {
    if (total >= maxSize || i > 8) {
      result.push(TRUNCATED);
      return [result, total, true];
    }
    let [t, size, trunc] = truncateObj(val[i], (maxSize - total) * 0.75);
    total += size;
    result.push(t);
    if (trunc) {
      truncated = true;
    }
  }
  return [result, total, truncated];
}

// if object is big, truncated it into around 1K~2K characters
function truncateObj(val: any, maxSize: number = 1024): [any, number, boolean] {
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
    let encoded = encodeRaw(val);
    if (typeof encoded === 'string' && encoded.length < 100) {
      return [encoded, encoded.length, false];
    }
    // TODO binary ?
    return [TRUNCATED, 4, true];
  } else if (typeof val === 'string') {
    if (val.length > maxSize / 2) {
      if (maxSize > 256) {
        return [`${val.substring(0, 128)}${TRUNCATED}`, 128, true];
      } else {
        return [`${val.substring(0, 8)}${TRUNCATED}`, 8, true];
      }
    }
    return [val, val.length, false];
  } else {
    return [val, 4, false];
  }
}

export function truncateData(val: any, maxSize: number = 1024): [any, number] {
  let [result, total, truncated] = truncateObj(val, maxSize);
  if (truncated) {
    if (Array.isArray(result)) {
      if (result.at(-1) !== TRUNCATED) {
        result.push(TRUNCATED);
      }
    } else if (result.constructor === Object) {
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
