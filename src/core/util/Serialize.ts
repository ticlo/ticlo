import JsonEsc from 'jsonesc';
import moment from 'moment';

const startTime = moment();
const Moment = startTime.constructor;

function encodeMoment() {
  return `\u001bTime:${(this as any).toISOString(true)}`;
}

function decodeMoment(str: string): any {
  return moment(str.substr(6));
}

let encoder = new JsonEsc();
encoder.registerRaw('Time', Moment, null, decodeMoment);

export function encode(value: any): string {
  let keepToJSON = Moment.prototype.toJSON;
  Moment.prototype.toJSON = encodeMoment;
  let result = encoder.stringifySorted(value, 1);
  Moment.prototype.toJSON = keepToJSON;
  return result;
}

export function decode(str: string): any {
  return encoder.parse(str);
}