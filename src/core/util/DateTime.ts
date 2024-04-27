import {DateTime} from 'luxon';

const startDate = DateTime.now();
export const invalidDate = DateTime.invalid('invalid input');

// this is for display purpose only, not for serialization
export function formatDate(m: DateTime, showTime: boolean): string {
  if (m) {
    if (m.isValid) {
      if (showTime) {
        return m.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ');
      }
      return m.toFormat('yyyy-LL-dd');
    } else {
      return m.invalidReason;
    }
  }
  return null;
}

// make sure invalid DateTime are treated as same
export function isDateSame(a: DateTime, b: DateTime) {
  return (a.invalidReason && a.invalidReason === b.invalidReason) || a.equals(b);
}

export function encodeDateTime(val: DateTime): string {
  if (val.invalidReason) {
    return `͢Ts:!${val.invalidReason}`;
  }
  if (val.zone.type === 'system') {
    return `͢Ts:${val.valueOf().toString(36)}`;
  }
  return `͢Ts:${val.valueOf().toString(36)}@${val.zoneName}`;
}

export function decodeDateTime(str: string): any {
  if (str.length > 5) {
    if (str.charAt(4) === '!') {
      return DateTime.invalid(str.substring(5));
    }
    const atPos = str.indexOf('@');
    if (atPos >= 0) {
      // with timezone
      return DateTime.fromMillis(parseInt(str.substring(4, atPos), 36), {zone: str.substring(atPos + 1)});
    }
    // 23 ISO length + 4 bytes header
    if (str.length >= 27) {
      // parse as ISO format
      return DateTime.fromISO(str.substring(4), {setZone: true});
    }
    // local time
    return DateTime.fromMillis(parseInt(str.substring(4), 36));
  } else {
    return DateTime.invalid('invalid jsonEsc Encode');
  }
}

export function toDateTime(input: unknown) {
  if (DateTime.isDateTime(input)) {
    return input;
  }
  switch (typeof input) {
    case 'number':
      return DateTime.fromMillis(input);
    case 'string': {
      if (input.endsWith(']')) {
        return DateTime.fromISO(input, {setZone: true});
      }
      return DateTime.fromISO(input);
    }
  }
  return invalidDate;
}

export const DATE_UNITS = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond', 'week'];
