import moment from 'moment';
import MomentTz from 'moment-timezone';

const startTs = moment();
export const MomentConstructor = startTs.constructor;

export function formatMoment(m: moment.Moment, showTime: boolean): string {
  if (m && m.isValid()) {
    if (showTime) {
      return m.format('YYYY-MM-DD HH:mmZ');
    } else {
      return m.format('YYYY-MM-DD');
    }
  }
  return null;
}

export function isMomentValid(m: moment.Moment) {
  return moment.isMoment(m) && m.isValid();
}

export function encodeMoment(val: any): string {
  return `\u001bTs:${val.toISOString(true)}`;
}

export function decodeMoment(str: string): any {
  return moment.parseZone(str.substr(4));
}
