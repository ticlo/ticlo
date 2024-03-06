import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import dayjs from 'dayjs';

describe('Serialize', function () {
  it('dayjs', function () {
    let iso8601 = '2014-11-27T11:07:00.000-08:00';
    let iso8601z = '2014-11-27T19:07:00.000Z';
    let str = `"\\u001bTs:${iso8601}"`;
    let strz = `"\\u001bTs:${iso8601z}"`;
    let time = dayjs(iso8601);
    expect(time.isSame(decode(str))).toBe(true);
    expect(encode(time)).toBe(strz);
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });
});
