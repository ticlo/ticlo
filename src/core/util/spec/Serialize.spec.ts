import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import dayjs from 'dayjs';

describe('Serialize', function () {
  it('dayjs local', function () {
    const dateStr = '2014-11-27T11:07:00.000';
    const encodedStr = `"\\u001bTs:${dateStr}"`;
    const time = dayjs(dateStr);
    const decoded = decode(encodedStr);
    expect(time.isSame(decoded)).toBe(true);
    expect(encode(decoded)).toBe(encodedStr);
  });
  it('dayjs tz', function () {
    const dateStrTz = '2014-11-27T11:07:00.000-03:00';
    const encodedStrTz = `"\\u001bTs:${dateStrTz}"`;
    const timeTz = dayjs(dateStrTz);
    const decodedTz = decode(encodedStrTz);
    expect(timeTz.isSame(decodedTz)).toBe(true);
    expect(encode(decodedTz)).toBe(encodedStrTz);
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });
});
