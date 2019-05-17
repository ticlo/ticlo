import moment from 'moment';

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
