import dayjs, {Dayjs} from 'dayjs';
import utc from 'dayjs/plugin/utc';
import arraySupport from 'dayjs/plugin/arraySupport';

dayjs.extend(utc);
dayjs.extend(arraySupport);

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

export function createDayjs(
  year: number,
  month: number,
  date: number,
  hour?: number,
  minute?: number,
  second?: number,
  millisecond?: number,
  timezone?: unknown
) {
  const d = dayjs([year, month, date, hour || 0, minute || 0, second || 0, millisecond || 0]);
  if (!d.isValid()) {
    return null;
  }
  if (timezone == null) {
    return d;
  }
  let tzFix = d.utcOffset();
  if (typeof timezone === 'number') {
    if (timezone <= 720 && timezone >= -720 && (timezone | 0) === timezone) {
      tzFix -= timezone;
    } else {
      return null; // invalid date
    }
  } else if (typeof timezone === 'string') {
    if (timezone.match(/^([+\-])\d\d:\d\d$/)) {
      const testTz = startTs.utcOffset(timezone);
      tzFix -= testTz.utcOffset();
    } else {
      return null;
    }
  }
  return d.add(tzFix, 'minute').utcOffset(timezone as any);
}
