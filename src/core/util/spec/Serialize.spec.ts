import expect from 'expect';
import {encode, decode, encodeDisplay} from '../Serialize';
import moment from 'moment';

describe('Serialize', function () {
  it('moment', function () {
    let iso8601 = '2014-11-27T11:07:00.000-08:00';
    let str = `"\\u001bTs:${iso8601}"`;
    let time = moment.parseZone(iso8601);
    expect(time.isSame(decode(str))).toBe(true);
    expect(encode(time)).toEqual(str);
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toEqual('NaN');
    expect(encodeDisplay(undefined)).toEqual('undefined');
    expect(encodeDisplay(-Infinity)).toEqual('-Inf');
  });
});
