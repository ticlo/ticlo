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

export function isDayjsSame(a: Dayjs, b: Dayjs) {
  return Object.is(a.valueOf(), b.valueOf()) && Object.is(a.utcOffset(), b.utcOffset());
}

function isDayjsTz(val: Dayjs) {
  return (val as any).$u || (val as any).$offset != null;
}

export function encodeDayjs(val: Dayjs): string {
  if (isDayjsTz(val)) {
    return `\u001bTs:${val.format('YYYY-MM-DDTHH:mm:ss.SSSZ')}`;
  } else {
    return `\u001bTs:${val.format('YYYY-MM-DDTHH:mm:ss.SSS')}`;
  }
}

export function decodeDayjs(str: string): any {
  if (str.length >= 33) {
    const originalTimezone = str.slice(-6);
    return dayjs(str.substring(4)).utcOffset(originalTimezone);
  } else {
    return dayjs(str.substring(4));
  }
}

export const invalidDay = dayjs(NaN);
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
  if (timezone == null) {
    return dayjs(new Date(year, month, date, hour || 0, minute || 0, second || 0, millisecond || 0));
  }
  let d = dayjs.utc(Date.UTC(year, month, date, hour || 0, minute || 0, second || 0, millisecond || 0));
  if (!d.isValid()) {
    return d;
  }
  let tzFix = 0;
  if (typeof timezone === 'number') {
    if (timezone <= 720 && timezone >= -720 && (timezone | 0) === timezone) {
      tzFix = -timezone;
    } else {
      return invalidDay; // invalid timezone
    }
  } else if (typeof timezone === 'string') {
    if (timezone.match(/^([+\-])\d\d:\d\d$/)) {
      const testTz = startTs.utcOffset(timezone);
      tzFix = -testTz.utcOffset();
    } else {
      return invalidDay; // invalid timezone
    }
  } else {
    return invalidDay; // invalid timezone
  }
  return d.add(tzFix, 'minute').utcOffset(timezone as any);
}

export function toDayjs(input: unknown) {
  if (dayjs.isDayjs(input)) {
    return input;
  }
  let d = dayjs(input as any);
  if (d.isValid()) {
    if (typeof input === 'string') {
      const m = /[+\-]\d\d:\d\d$/.exec(input);
      if (m) {
        d = d.utcOffset(m[0]);
      }
    }
  }
  return d;
}

export const DATE_UNITS = ['year', 'month', 'date', 'day', 'hour', 'minute', 'second', 'millisecond', 'week'];

// workaround for dayjs bug related to add()
export function addDayjs(day: Dayjs, count: number, unit: string) {
  if (count === 0) {
    return day;
  }
  if (!isDayjsTz(day)) {
    // built in add works without timezone
    return day.add(count, unit as any);
  }
  let deltaMs = 0;
  if (day?.isValid() && count === (count | 0)) {
    switch (unit) {
      case 'year':
        return createDayjs(
          day.year() + count,
          day.month(),
          day.date(),
          day.hour(),
          day.minute(),
          day.second(),
          day.millisecond(),
          day.utcOffset()
        );
      case 'month':
        return createDayjs(
          day.year(),
          day.month() + count,
          day.date(),
          day.hour(),
          day.minute(),
          day.second(),
          day.millisecond(),
          day.utcOffset()
        );
      case 'day':
      case 'date':
        deltaMs = 24 * 3600_000 * count;
        break;
      case 'hour':
        deltaMs = 3600_000 * count;
        break;
      case 'minute':
        deltaMs = 60_000 * count;
        break;
      case 'second':
        deltaMs = 1000 * count;
        break;
      case 'millisecond':
        deltaMs = count;
        break;
      case 'week':
        deltaMs = 7 * 24 * 3600_000 * count;
        break;
      default:
        return invalidDay;
    }
    return dayjs.utc(new Date(day.valueOf() + deltaMs)).utcOffset(day.utcOffset());
  }
  return invalidDay;
}
