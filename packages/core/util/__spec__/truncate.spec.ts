import {expect} from 'vitest';
import type {DataMap} from '../DataTypes.ts';
import {measureObjSize, TRUNCATED, isDataTruncated, getTruncatedArrayLength} from '../DataTypes.ts';
import {truncateData} from '../DataTruncate.ts';

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
    expect(isDataTruncated(tobj)).toBeTruthy();
  });

  it('uses the size budget instead of a fixed collection length', function () {
    const obj: any = {};
    const arr: any[] = [];
    for (let i = 0; i < 32; ++i) {
      obj[i] = i;
      arr.push(i);
    }

    const objResult = truncateData(obj)[0];
    expect(objResult).toEqual(obj);
    expect(isDataTruncated(objResult)).toBe(false);

    const arrResult = truncateData(arr)[0];
    expect(arrResult).toEqual(arr);
    expect(isDataTruncated(arrResult)).toBe(false);
    expect(isDataTruncated(truncateData(obj, 32)[0])).toBe(true);
    expect(isDataTruncated(truncateData(arr, 32)[0])).toBe(true);
  });

  it('preserves array lengths at every truncated level without treating metadata as items', () => {
    const rows = Array.from({length: 10_000}, (_, id) => ({id}));
    const preview = truncateData({rows}, 128)[0];
    expect(preview.rows.slice(-2)).toEqual([TRUNCATED, rows.length]);
    expect(getTruncatedArrayLength(preview.rows)).toBe(10_000);
    expect(isDataTruncated(preview.rows)).toBe(true);
    const nested = truncateData([rows], 128)[0];
    expect(nested.slice(-2)).toEqual([TRUNCATED, 1]);
    expect(getTruncatedArrayLength(nested[0])).toBe(10_000);
    expect(isDataTruncated([1, 2])).toBe(false);
    expect(isDataTruncated([TRUNCATED, -1])).toBe(false);
    expect(isDataTruncated([TRUNCATED, '1000'])).toBe(false);
  });

  it('scales string previews with the requested budget', () => {
    const value = 'x'.repeat(1200);
    const small = truncateData(value, 128)[0] as string;
    const larger = truncateData(value, 512)[0] as string;
    expect(isDataTruncated(small)).toBe(true);
    expect(isDataTruncated(larger)).toBe(true);
    expect(larger.length).toBeGreaterThan(small.length);
    expect(truncateData(value, 4096)[0]).toBe(value);
  });

  it('bounds traversal of empty values and cyclic collections by the budget', () => {
    let reads = 0;
    const array = new Array(512);
    for (let i = 0; i < array.length; ++i) {
      Object.defineProperty(array, i, {
        get: () => {
          ++reads;
          return '';
        },
      });
    }
    expect(isDataTruncated(truncateData(array, 32)[0])).toBe(true);
    const smallReads = reads;
    reads = 0;
    expect(isDataTruncated(truncateData(array, 64)[0])).toBe(true);
    expect(reads).toBeGreaterThan(smallReads);
    expect(reads).toBeLessThanOrEqual(64);

    const cyclic: DataMap = {};
    cyclic.self = cyclic;
    const preview = truncateData(cyclic, 64)[0];
    expect(isDataTruncated(preview)).toBe(true);
    expect(() => JSON.stringify(preview)).not.toThrow();
  });

  it('measure object', function () {
    const size1 = measureObjSize(bigObj, 1024);
    expect(size1).toBeGreaterThanOrEqual(1024);
    const size2 = measureObjSize(bigObj, Infinity);
    expect(size2).toBeGreaterThan(size1);
  });

  it('uses the requested limit for objects nested in arrays', function () {
    const child: DataMap = {};
    for (let i = 0; i < 32; ++i) {
      child[i] = 'x'.repeat(100);
    }

    expect(measureObjSize([child], Infinity)).toBe(measureObjSize(child, Infinity));
  });
});
