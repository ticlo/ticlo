import {expect} from 'vitest';
import type {DataMap} from '../DataTypes.js';
import {measureObjSize, TRUNCATED, isDataTruncated} from '../DataTypes.js';
import {truncateData} from '../DataTruncate.js';

describe('truncateData', function () {
  let longstr = '1234567890';
  const bigObj: {child: DataMap; arr: unknown[]} & DataMap = {child: {}, arr: []};
  for (let i = 0; i < 8; i++) {
    longstr += longstr;
    bigObj[i] = longstr;
    bigObj.child[i] = longstr;
    bigObj.arr.push(longstr);
  }

  it('big string', function () {
    const tstr: string = truncateData(longstr)[0] as string;
    expect(tstr.length).toBe(131);
    expect(isDataTruncated(tstr)).toBeTruthy();
  });

  it('big obj', function () {
    const tobj: DataMap = truncateData(bigObj)[0];
    expect(JSON.stringify(tobj).length < 2048).toBeTruthy();
    expect(Object.keys(tobj).length).toBe(10);
    expect(isDataTruncated(tobj)).toBeTruthy();
  });

  it('max number of item', function () {
    const obj: any = {};
    const arr: any[] = [];
    for (let i = 0; i < 32; ++i) {
      obj[i] = i;
      arr.push(i);
    }

    const objResult = truncateData(obj)[0];
    expect(Object.keys(objResult).length).toBe(10);
    expect(isDataTruncated(objResult)).toBe(true);

    const arrResult = truncateData(arr)[0];
    expect(arrResult.length).toBe(10);
    expect(isDataTruncated(arrResult)).toBe(true);
  });

  it('measure object', function () {
    const size1 = measureObjSize(bigObj, 1024);
    expect(size1).toBeGreaterThanOrEqual(1024);
    const size2 = measureObjSize(bigObj, Infinity);
    expect(size2).toBeGreaterThan(size1);
  });
});
