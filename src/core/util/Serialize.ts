import Arrow from 'arrow-code';
import {DateTime} from 'luxon';
import {decodeDateTime, encodeDateTime, encodeDateTimeDisplay, formatDate} from './DateTime';
import {decodeUnknown, encodeUnknown, EscapedObject} from './EscapedObject';

const arrow = new Arrow({encodeDate: false});
arrow.registerRaw('Ts', DateTime, encodeDateTime, decodeDateTime);
arrow.registerRaw('', EscapedObject, encodeUnknown, decodeUnknown);

export const arrowVerbose = new Arrow({encodeDate: false});
arrowVerbose.registerRaw('Ts', DateTime, encodeDateTimeDisplay, decodeDateTime);
arrowVerbose.registerRaw('', EscapedObject, encodeUnknown, decodeUnknown);

export const verboseReplacer = arrowVerbose.replacer.bind(arrowVerbose);
export const verboseReviver = arrowVerbose.reviver.bind(arrowVerbose);

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
export function encodeVerbose(value: any, space = 2) {
  return arrowVerbose.stringify(value, space);
}
export function encodeSorted(value: any, space = 1): string {
  return arrow.stringifySorted(value, space);
}

export function decode(str: string): any {
  return arrow.parse(str);
}

export const decodeReceiver = (key: string, value: any) => arrow.reviver(key, value);

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
  return arrowVerbose.stringify(value).replace(displayRegex, replaceDisplay);
}
