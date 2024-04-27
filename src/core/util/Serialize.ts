import JsonEsc from 'jsonesc';
import {DateTime} from 'luxon';
import {decodeDateTime, encodeDateTime, formatDate} from './DateTime';
import {decodeUnknown, encodeUnknown, EscapedObject} from './EscapedObject';
import {Block} from '../block/Block';

let jsonesc = new JsonEsc();
jsonesc.registerRaw('Ts', DateTime, encodeDateTime, decodeDateTime);
jsonesc.registerRaw('', EscapedObject, encodeUnknown, decodeUnknown);
jsonesc.registerRaw(null, Block, encodeUnknown, null);

export function encodeRaw(obj: object) {
  return jsonesc.replacer('', obj, null);
}

export function encode(value: any, space = 0): string {
  return jsonesc.stringify(value, space);
}

export function encodeSorted(value: any, space = 1): string {
  return jsonesc.stringifySorted(value, space);
}

export function decode(str: string): any {
  return jsonesc.parse(str);
}

export const decodeReceiver = (key: string, value: any) => jsonesc.reviver(key, value);

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
  return jsonesc.stringify(value).replace(displayRegex, replaceDisplay);
}
