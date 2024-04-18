import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import {DateTime} from 'luxon';
import {formatDate, isDateSame} from '../DateTime';

describe('Serialize', function () {
  it('DateTime local', function () {
    const dateStr = '2014-11-27T11:07:00.000';
    const date = DateTime.fromISO(dateStr);
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"\\u001bTs:i30ht9uo"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 PST');
    expect(formatDate(date, false)).toBe('2014-11-27');
  });
  it('DateTime tz', function () {
    const dateStr = '2014-11-27T11:07:00.000-03:00';
    const date = DateTime.fromISO(dateStr, {setZone: true});
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"\\u001bTs:i3073gyo@UTC-3"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 UTC-3');
  });
  it('DateTime invalid', function () {
    const date = DateTime.invalid('test invalid');
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"\\u001bTs:!test invalid"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('test invalid');
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });
});
