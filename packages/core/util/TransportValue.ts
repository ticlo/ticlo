import {DateTime} from 'luxon';
import {isDateSame} from './DateTime.ts';
import {encodeRaw} from './Serialize.ts';

function transportValue(value: any, arrayItem = false): any {
  if (typeof value === 'symbol') return arrayItem ? null : undefined;
  if (typeof value === 'function') return encodeRaw(value) ?? (arrayItem ? null : undefined);
  if (!value || typeof value !== 'object') return value;
  if ((Array.isArray(value) || value.constructor === Object) && typeof value.toJSON !== 'function') return value;
  if (DateTime.isDateTime(value) || value instanceof Uint8Array) return value;
  const encoded = encodeRaw(value);
  if (encoded !== value) return encoded;
  if (typeof value.toJSON === 'function') {
    const json = value.toJSON();
    if (json !== value) return transportValue(json, arrayItem);
  }
  return value;
}

/** Compare data using Arrow transport semantics without serializing the whole value. */
export function deepEqualTransport(a: unknown, b: unknown): boolean {
  const pairs = new WeakMap<object, WeakSet<object>>();
  function equal(a: any, b: any, arrayItem = false): boolean {
    a = transportValue(a, arrayItem);
    b = transportValue(b, arrayItem);
    if (a === b || Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (DateTime.isDateTime(a) || DateTime.isDateTime(b)) {
      return DateTime.isDateTime(a) && DateTime.isDateTime(b) && isDateSame(a, b);
    }
    if (a instanceof Uint8Array || b instanceof Uint8Array) {
      if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
      return a.every((byte, index) => byte === b[index]);
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const seen = pairs.get(a);
    if (seen?.has(b)) return true;
    if (seen) seen.add(b);
    else pairs.set(a, new WeakSet([b]));
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let index = 0; index < a.length; ++index) if (!equal(a[index], b[index], true)) return false;
      return true;
    }
    const remaining = new Set(Object.keys(b));
    for (const key of Object.keys(a)) {
      const value = transportValue(a[key]);
      if (value === undefined) continue;
      if (!remaining.delete(key) || !equal(value, b[key])) return false;
    }
    for (const key of remaining) if (transportValue(b[key]) !== undefined) return false;
    return true;
  }
  return equal(a, b);
}

/** Capture comparison data without retaining mutable row/array/binary references. */
export function snapshotTransportValue<T>(value: T): T {
  const copies = new WeakMap<object, unknown>();
  function copy(value: any, arrayItem = false): any {
    value = transportValue(value, arrayItem);
    if (!value || typeof value !== 'object' || DateTime.isDateTime(value)) return value;
    if (value instanceof Uint8Array) return value.slice();
    if (copies.has(value)) return copies.get(value);
    const result: any = Array.isArray(value) ? new Array(value.length) : {};
    copies.set(value, result);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; ++index) result[index] = copy(value[index], true);
    } else {
      for (const key of Object.keys(value)) {
        const child = copy(value[key]);
        if (child !== undefined)
          Object.defineProperty(result, key, {value: child, enumerable: true, writable: true, configurable: true});
      }
    }
    return result;
  }
  return copy(value);
}
