import JsonEsc from 'jsonesc';
import moment from 'moment';
import {MomentConstructor} from './Moment';

function encodeMoment(val: any): string {
  return `\u001bTs:${val.toISOString(true)}`;
}

function decodeMoment(str: string): any {
  return moment.parseZone(str.substr(4));
}

let encoder = new JsonEsc();
encoder.registerRaw('Ts', MomentConstructor, encodeMoment, decodeMoment);

export function encode(value: any): string {
  return encoder.stringify(value);
}

export function encodeSorted(value: any): string {
  return encoder.stringifySorted(value, 1);
}

export function decode(str: string): any {
  return encoder.parse(str);
}

const displayRegex = /"\\u001b(\w+:)?([^"]*)"/g;

function replaceDisplay(str: string, g1: string, g2: string) {
  return g2 || 'undefined';
}

export function encodeDisplay(value: any): string {
  return encoder.stringify(value).replace(displayRegex, replaceDisplay);
}
