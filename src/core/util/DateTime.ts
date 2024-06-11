import {DateTime} from 'luxon';
import {getDefaultZone, systemZone} from './Settings';

export const invalidDate = DateTime.invalid('invalid input');

export function getZoneObject(zoneName: unknown): {zone: string} {
  let z = zoneName as string;
  if (!zoneName || typeof zoneName !== 'string') {
    z = getDefaultZone();
  }
  if (z === systemZone) {
    return {zone: undefined};
  }
  return {zone: z};
}

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
  return (
    (a.invalidReason && a.invalidReason === b.invalidReason) ||
    (a.valueOf() === b.valueOf() && a.zoneName === b.zoneName)
  );
}

export function encodeDateTime(val: DateTime): string {
  if (val.invalidReason) {
    return `͢Ts:!${val.invalidReason}`;
  }
  let s = `͢Ts:${val.toISO({includeOffset: false})}`;
  if (val.isInDST) {
    s = s + '*';
  }
  if (val.zoneName !== getDefaultZone()) {
    s = s + '@' + val.zoneName;
  }
  return s;
}

export function encodeDateTimeDisplay(val: DateTime): string {
  if (val.invalidReason) {
    return `͢Ts:!${val.invalidReason}`;
  }
  if (val.zoneName === getDefaultZone()) {
    return `͢Ts:${val.toISO({includeOffset: !val.zone.isUniversal})}`;
  }
  return `͢Ts:${val.toISO({includeOffset: !val.zone.isUniversal, extendedZone: true})}`;
}

export function decodeDateTime(str: string): any {
  if (str.length > 5) {
    if (str.charAt(4) === '!') {
      return DateTime.invalid(str.substring(5));
    }

    if (str.indexOf('-') === 8) {
      // new format
      let [ts, z] = str.split('@');
      let isInDST = ts.endsWith('*');
      if (isInDST) {
        ts = ts.substring(4, ts.length - 1);
      } else {
        ts = ts.substring(4);
      }
      let result = DateTime.fromISO(ts, getZoneObject(z));
      if (isInDST !== result.isInDST) {
        let r2 = result.plus({hour: isInDST ? -1 : +1});
        if (isInDST === r2.isInDST) {
          return r2;
        }
      }
      return result;
    }

    const atPos = str.indexOf('@');
    if (atPos >= 0) {
      // with timezone
      let zone = str.substring(atPos + 1);
      return DateTime.fromMillis(parseInt(str.substring(4, atPos), 36), getZoneObject(zone));
    }
    // 23 ISO length + 4 bytes header
    if (str.length >= 27) {
      // parse as ISO format
      return DateTime.fromISO(str.substring(4), {setZone: str.endsWith(']')});
    }
    // local time
    return DateTime.fromMillis(parseInt(str.substring(4), 36));
  } else {
    return DateTime.invalid('invalid Arrow COde');
  }
}

export function toDateTime(input: unknown, zone?: string) {
  if (DateTime.isDateTime(input)) {
    if (input.zoneName === 'Factory') {
      return DateTime.fromObject(
        {
          year: input.year,
          month: input.month,
          day: input.day,
          hour: input.hour,
          minute: input.minute,
          second: input.second,
          millisecond: input.millisecond,
        },
        getZoneObject(zone)
      );
    }
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
