import Arrow from 'arrow-code';
import {DateTime} from 'luxon';
import {decodeDateTime, encodeDateTime, formatDate} from './DateTime';
import {decodeUnknown, encodeUnknown, EscapedObject} from './EscapedObject';
import {Block} from '../block/Block';

let arrow = new Arrow({encodeDate: false});
arrow.registerRaw('Ts', DateTime, encodeDateTime, decodeDateTime);
arrow.registerRaw('', EscapedObject, encodeUnknown, decodeUnknown);
arrow.registerRaw(null, Block, encodeUnknown, null);

export function encodeRaw(obj: object) {
  return arrow.replacer('', obj, null);
}

export function encode(value: any, space = 0): string {
  return arrow.stringify(value, space);
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
  return arrow.stringify(value).replace(displayRegex, replaceDisplay);
}
