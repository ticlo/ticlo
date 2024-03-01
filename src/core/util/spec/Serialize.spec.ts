import {expect} from 'vitest';
import {encode, decode, encodeDisplay} from '../Serialize';
import moment from 'moment';

describe('Serialize', function () {
  it('moment', function () {
    let iso8601 = '2014-11-27T11:07:00.000-08:00';
    let str = `"\\u001bTs:${iso8601}"`;
    let time = moment.parseZone(iso8601);
    expect(time.isSame(decode(str))).toBe(true);
    expect(encode(time)).toBe(str);
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });
});
