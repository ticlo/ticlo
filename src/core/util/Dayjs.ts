import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const startTs = dayjs();
export const DayjsConstructor = startTs.constructor;

export function formatDayjs(m: Dayjs, showTime: boolean): string {
  if (m && m.isValid()) {
    if (showTime) {
      return m.format('YYYY-MM-DD HH:mmZ');
    } else {
      return m.format('YYYY-MM-DD');
    }
  }
  return null;
}

export function isDayjsValid(d: Dayjs) {
  return dayjs.isDayjs(d) && d.isValid();
}

export function encodeDayjs(val: Dayjs): string {
  return `\u001bTs:${val.format('YYYY-MM-DDTHH:mm:ss.SSSZ')}`;
}

export function decodeDayjs(str: string): any {
  const originalTimezone = str.slice(-6);
  return dayjs(str.substring(4)).utcOffset(originalTimezone);
}
