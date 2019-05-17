import JsonEsc from 'jsonesc';
import moment from 'moment';

const startTs = moment();
const Moment = startTs.constructor;

function encodeMoment(val: any): string {
  return `\u001bTs:${val.toISOString(true)}`;
}

function decodeMoment(str: string): any {
  return moment.parseZone(str.substr(4));
}

let encoder = new JsonEsc();
encoder.registerRaw('Ts', Moment, encodeMoment, decodeMoment);

export function encode(value: any): string {
  return encoder.stringifySorted(value, 1);
}

export function decode(str: string): any {
  return encoder.parse(str);
}