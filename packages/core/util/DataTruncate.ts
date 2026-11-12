import {DataMap, isBaseObject, TRUNCATED} from './DataTypes.ts';
import {decode, decodeReviver, encodeRaw} from './Serialize.ts';
import QS from 'qs';
import {DateTime} from 'luxon';
import {ErrorEvent} from '../block/Event.ts';

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
    if (val instanceof ErrorEvent) {
      if (maxSize <= 16) return [new ErrorEvent(undefined, TRUNCATED), 16, true];
      const [type, typeSize, typeTruncated] = truncateObj(val.type, Math.max(0, maxSize / 4));
      const [detail, size, detailTruncated] = truncateObj(val.detail, Math.max(0, maxSize - typeSize - 16) * 0.75);
      if (detailTruncated && detail?.constructor === Object) detail[TRUNCATED] = 1;
      const truncated = typeTruncated || detailTruncated;
      return [truncated ? new ErrorEvent(type, detail) : val, typeSize + size + 16, truncated];
    }
    if (val instanceof Error) {
      const code = (val as Error & {code?: string | number}).code;
      const [message, messageSize, messageTruncated] = truncateObj(val.message, maxSize * 0.6);
      const [name, nameSize, nameTruncated] = truncateObj(val.name, maxSize * 0.15);
      const [previewCode, codeSize, codeTruncated] = truncateObj(code, maxSize * 0.15);
      const truncated = messageTruncated || nameTruncated || codeTruncated;
      const preview = truncated ? Object.assign(new Error(message), {name, code: previewCode}) : val;
      return [preview, messageSize + nameSize + codeSize + 12, truncated];
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
