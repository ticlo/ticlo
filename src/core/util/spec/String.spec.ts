import {assert} from 'chai';
import {getPreNumber, getTailingNumber, isColorStr, smartStrCompare} from '../String';
import {encodeTicloName, getDisplayName} from '../Name';

describe('String', function() {
  it('smartStrCompare', () => {
    assert.equal(
      '3,1,2'
        .split(',')
        .sort(smartStrCompare)
        .join(','),
      '1,2,3'
    );

    // test number
    assert.equal(
      'a123,a13,b12,b8,a4,a55,c1'
        .split(',')
        .sort(smartStrCompare)
        .join(','),
      'a4,a13,a55,a123,b8,b12,c1'
    );

    // test sign
    assert.equal(
      'a+123,a+13c,a+4,a-123,a-13,a+14b,a-4,a+13d,a0'
        .split(',')
        .sort(smartStrCompare)
        .join(','),
      'a-123,a-13,a-4,a+4,a+13c,a+13d,a+14b,a+123,a0'
    );

    // test upper lower case
    assert.equal(
      'aAA,AaA,aCa,AAa,aAa,AAB'
        .split(',')
        .sort(smartStrCompare)
        .join(','),
      'AAa,AaA,aAA,aAa,AAB,aCa'
    );
  });

  it('getTailingNumber', function() {
    assert.equal(getTailingNumber('1'), 1);
    assert.equal(getTailingNumber('a02'), 2);
    assert.equal(getTailingNumber('a'), -1);
  });

  it('getPreNumber', function() {
    assert.equal(getPreNumber('1'), '');
    assert.equal(getPreNumber('a02'), 'a');
    assert.equal(getPreNumber('a'), null);
  });

  it('isColor', function() {
    assert.isTrue(isColorStr('#aaa'));
    assert.isTrue(isColorStr('#FFFFFFFF'));
    assert.isTrue(isColorStr('rgb(1, 2, 3)'));
    assert.isTrue(isColorStr('rgba(1,2,3,0.5)'));

    assert.isFalse(isColorStr(' #aaa'));
    assert.isFalse(isColorStr('rgb()'));
  });

  it('encodeTicloName', function() {
    assert.equal(encodeTicloName('.'), '%2e');
    // invalid input
    assert.equal(encodeTicloName('\0'), '');
  });

  it('getDisplayName', function() {
    assert.equal(getDisplayName('.', 'a'), 'a');
    assert.equal(getDisplayName('b', null), 'b');
    assert.equal(getDisplayName('%20', null), ' ');
    assert.equal(getDisplayName('%20%', null), '%20%');
  });
});
