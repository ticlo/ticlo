import JsonEsc from 'jsonesc';
import moment from 'moment';

const startTime = moment();
const Moment = startTime.constructor;

function encodeMoment(val: any): string {
  return `\u001bTime:${val.toISOString(true)}`;
}

function decodeMoment(str: string): any {
  return moment.parseZone(str.substr(6));
}

let encoder = new JsonEsc();
encoder.registerRaw('Time', Moment, encodeMoment, decodeMoment);

export function encode(value: any): string {
  return encoder.stringifySorted(value, 1);
}

export function decode(str: string): any {
  return encoder.parse(str);
}