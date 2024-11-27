import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import {DateTime} from 'luxon';
import {formatDate, isDateSame} from '../DateTime';

describe('Serialize', function () {
  it('DateTime local', function () {
    const dateStr = '2014-11-27T11:07:00.000';
    const date = DateTime.fromISO(dateStr);
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:2014-11-27T11:07:00.000"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 PST');
    expect(formatDate(date, false)).toBe('2014-11-27');
    // decode from ISO format
    expect(isDateSame(date, decode(`"͢Ts:${dateStr}"`))).toBe(true);
  });
  it('DateTime tz', function () {
    const dateStr = '2014-11-27T11:07:00.000-03:00';
    const date = DateTime.fromISO(dateStr, {setZone: true});
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:2014-11-27T11:07:00.000@UTC-3"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 UTC-3');
  });
  it('DateTime invalid', function () {
    const date = DateTime.invalid('test invalid');
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:!test invalid"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('test invalid');
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });

  it('day light saving', function () {
    let d7 = DateTime.fromISO('2024-11-03T01:30:21.123-07:00');
    let d8 = DateTime.fromISO('2024-11-03T01:30:21.123-08:00');
    let d7Encoded = encode(d7);
    let d8Encoded = encode(d8);
    expect(d7Encoded).toBe('"͢Ts:2024-11-03T01:30:21.123*"');
    expect(d8Encoded).toBe('"͢Ts:2024-11-03T01:30:21.123"');
    expect(isDateSame(d7, decode(d7Encoded))).toBe(true);
    expect(isDateSame(d8, decode(d8Encoded))).toBe(true);

    let s11 = DateTime.fromISO('2025-04-06T02:30:00.000+11:00', {zone: 'Australia/Sydney'});
    let s10 = DateTime.fromISO('2025-04-06T02:30:00.000+10:00', {zone: 'Australia/Sydney'});
    let s11Encoded = encode(s11);
    let s10Encoded = encode(s10);
    expect(s11Encoded).toBe('"͢Ts:2025-04-06T02:30:00.000*@Australia/Sydney"');
    expect(s10Encoded).toBe('"͢Ts:2025-04-06T02:30:00.000@Australia/Sydney"');
    expect(isDateSame(s11, decode(s11Encoded))).toBe(true);
    expect(isDateSame(s10, decode(s10Encoded))).toBe(true);
  });
});
