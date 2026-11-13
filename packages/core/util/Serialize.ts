import Arrow from 'arrow-code';
import {DateTime} from 'luxon';
import {decodeDateTime, encodeDateTime, formatDate} from './DateTime.ts';
import {decodeUnknown, encodeUnknown, NoSerialize} from './NoSerialize.ts';
import {ErrorEvent} from '../block/Event.ts';

const arrow = new Arrow({encodeDate: false});
arrow.registerRaw('Ts', DateTime, encodeDateTime, decodeDateTime);
arrow.registerRaw('', NoSerialize, encodeUnknown, decodeUnknown);

function encodeError(error: Error & {code?: string | number}): string {
  const data: unknown[] = [error.message];
  if (error.name !== 'Error' || error.code !== undefined) data.push(error.name === 'Error' ? null : error.name);
  if (error.code !== undefined) data.push(error.code);
  return JSON.stringify(data);
}

function decodeError(encoded: string): Error {
  const [message, name, code] = JSON.parse(encoded);
  const error = new Error(message);
  if (name) error.name = name;
  if (code !== undefined) Object.assign(error, {code});
  return error;
}

for (const type of [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, AggregateError]) {
  arrow.register('e', type, encodeError, decodeError);
}

arrow.register(
  'E',
  ErrorEvent,
  (event: ErrorEvent) => {
    const detail =
      event.detail instanceof Error
        ? `͢e:${encodeError(event.detail)}`
        : (arrow.encode(event.detail) ?? `͢${arrow.stringify(event.detail)}`);
    return JSON.stringify(
      event.type === ErrorEvent.defaultType ? (event.detail === undefined ? [] : [detail]) : [event.type, detail]
    );
  },
  (encoded: string) => {
    const data = JSON.parse(encoded);
    return data.length < 2
      ? new ErrorEvent(undefined, data.length ? arrow.decode(data[0]) : undefined)
      : new ErrorEvent(data[0], arrow.decode(data[1]));
  }
);

export const arrowReplacer = arrow.replacer.bind(arrow);
export const arrowReviver = arrow.reviver.bind(arrow);

class ZoneEncoder {
  constructor(public readonly zone: string) {}
}

// allow the type to be encoded, but it won't be decoded
export function encodeToUnknown(type: object) {
  arrow.registerRaw(null, type, encodeUnknown, null);
}

export function encodeRaw(obj: object) {
  return arrow.replacer('', obj, null);
}

export function encode(value: any, space = 0): string {
  return arrow.stringify(value, space);
}

export function encodeSorted(value: any, space = 1): string {
  return arrow.stringifySorted(value, space);
}

// Hash the wire representation with stable object key ordering.
export function hashData(value: unknown): number {
  const str = encodeSorted(JSON.parse(encode(value)), 0);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; ++i) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

export function decode(str: string): any {
  return arrow.parse(str);
}

export const decodeReviver = (key: string, value: any) => arrow.reviver(key, value);

const displayRegex = /"͢(\w*:)?([^"]*)"/g;

function replaceDisplay(str: string, g1: string, g2: string) {
  return g2;
}

export function encodeDisplay(value: any, expandArray = true): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (expandArray && Array.isArray(value)) {
    return `[${value.map((v) => encodeDisplay(v, false)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    if (value.constructor === DateTime) {
      return formatDate(value, true);
    }
  }
  return arrow.stringify(value).replace(displayRegex, replaceDisplay);
}
