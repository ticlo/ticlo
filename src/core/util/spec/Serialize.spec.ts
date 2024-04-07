import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import dayjs from 'dayjs';

describe('Serialize', function () {
  it('dayjs', function () {
    const iso8601 = '2014-11-27T11:07:00.000-03:00';
    const str = `"\\u001bTs:${iso8601}"`;
    const time = dayjs(iso8601);
    const decoded = decode(str);
    expect(time.isSame(decoded)).toBe(true);
    expect(encode(decoded)).toBe(str);
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });
});
