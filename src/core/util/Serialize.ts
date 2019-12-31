import JsonEsc from 'jsonesc';
import {decodeMoment, encodeMoment, MomentConstructor} from './Moment';
import {decodeUnknown, encodeUnknown, EscapedObject} from './EscapedObject';
import {Block} from '../block/Block';

let jsonesc = new JsonEsc();
jsonesc.registerRaw('Ts', MomentConstructor, encodeMoment, decodeMoment);
jsonesc.registerRaw('', EscapedObject, encodeUnknown, decodeUnknown);
jsonesc.registerRaw(null, Block, encodeUnknown, null);

export function encodeRaw(obj: object) {
  return jsonesc.replacer('', obj);
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

const displayRegex = /"\\u001b(\w*:)?([^"]*)"/g;

function replaceDisplay(str: string, g1: string, g2: string) {
  return g2;
}

export function encodeDisplay(value: any): string {
  if (value === undefined) {
    return 'undefined';
  }
  return jsonesc.stringify(value).replace(displayRegex, replaceDisplay);
}
