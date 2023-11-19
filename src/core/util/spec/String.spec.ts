import expect from 'expect';
import {getPreNumber, getTailingNumber, isColorStr, nameFromPath, smartStrCompare} from '../String';
import {encodeTicloName, getDisplayName} from '../Name';

describe('String', function () {
  it('smartStrCompare', () => {
    expect('3,1,2'.split(',').sort(smartStrCompare).join(',')).toBe('1,2,3');

    // test number
    expect('a123,a13,b12,b8,a4,a55,c1'.split(',').sort(smartStrCompare).join(',')).toBe('a4,a13,a55,a123,b8,b12,c1');

    // test sign
    expect('a+123,a+13c,a+4,a-123,a-13,a+14b,a-4,a+13d,a0'.split(',').sort(smartStrCompare).join(',')).toEqual(
      'a-123,a-13,a-4,a+4,a+13c,a+13d,a+14b,a+123,a0'
    );

    // test upper lower case
    expect('aAA,AaA,aCa,AAa,aAa,AAB'.split(',').sort(smartStrCompare).join(',')).toBe('AAa,AaA,aAA,aAa,AAB,aCa');
  });

  it('getTailingNumber', function () {
    expect(getTailingNumber('1')).toBe(1);
    expect(getTailingNumber('a02')).toBe(2);
    expect(getTailingNumber('a')).toEqual(-1);
  });

  it('getPreNumber', function () {
    expect(getPreNumber('1')).toBe('');
    expect(getPreNumber('a02')).toBe('a');
    expect(getPreNumber('a')).toEqual(null);
  });

  it('isColor', function () {
    expect(isColorStr('#aaa')).toBe(true);
    expect(isColorStr('#FFFFFFFF')).toBe(true);
    expect(isColorStr('rgb(1, 2, 3)')).toBe(true);
    expect(isColorStr('rgba(1,2,3,0.5)')).toBe(true);

    expect(isColorStr(' #aaa')).toBe(false);
    expect(isColorStr('rgb()')).toBe(false);
  });

  it('encodeTicloName', function () {
    expect(encodeTicloName('.')).toBe('%2e');
    // invalid input
    expect(encodeTicloName('\0')).toBe('');
  });

  it('getDisplayName', function () {
    expect(getDisplayName('.', 'a')).toBe('a');
    expect(getDisplayName('b', null)).toBe('b');
    expect(getDisplayName('%20', null)).toBe(' ');
    expect(getDisplayName('%20%', null)).toBe('%20%');
  });

  it('nameFromPath', function () {
    expect(nameFromPath(null)).toEqual(null);
    expect(nameFromPath('a')).toBe('a');
    expect(nameFromPath('a.b')).toBe('b');
  });
});
