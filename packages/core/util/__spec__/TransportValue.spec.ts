import {DateTime} from 'luxon';
import {Root} from '../../block/Flow.ts';
import {deepEqual} from '../Compare.ts';
import {escapedObject} from '../NoSerialize.ts';
import {decode, encode} from '../Serialize.ts';
import {deepEqualTransport, snapshotTransportValue} from '../TransportValue.ts';

describe('transport values', () => {
  it('compares runtime values with their Arrow round trip', () => {
    const root = new Root();
    try {
      const shared = {count: 1};
      const row = {
        block: root.addFlow('Main'),
        escaped: escapedObject('Service:test', {}),
        date: DateTime.fromISO('2026-11-08T12:00:00', {zone: 'America/Los_Angeles'}),
        nativeDate: new Date('2026-11-08T12:00:00Z'),
        binary: new Uint8Array([0, 128, 255]),
        values: [undefined, () => {}, Symbol(), NaN, Infinity, -Infinity],
        omitted: undefined as unknown,
        callback: () => {},
        a: shared,
        b: shared,
      };
      const transported = decode(encode(row));
      expect(deepEqualTransport(row, transported)).toBe(true);
      expect(deepEqualTransport(transported, row)).toBe(true);
      expect(deepEqual(row, transported)).toBe(false);
      transported.binary[0] = 1;
      expect(deepEqualTransport(row, transported)).toBe(false);
    } finally {
      root.destroy();
    }
  });

  it('preserves meaningful differences and ignores omitted object fields', () => {
    expect(deepEqualTransport({a: 1, omitted: undefined}, {a: 1})).toBe(true);
    expect(deepEqualTransport({a: 1}, {a: 1, omitted: null})).toBe(false);
    expect(deepEqualTransport([undefined], [null])).toBe(false);
    expect(deepEqualTransport([], {})).toBe(false);
    expect(deepEqualTransport([1], [1, 2])).toBe(false);
    expect(deepEqualTransport({value: 1}, {value: '1'})).toBe(false);
    expect(deepEqualTransport(DateTime.utc(2026), DateTime.utc(2025))).toBe(false);
    expect(deepEqual({omitted: undefined}, {})).toBe(false);
  });

  it('captures an anchor independently of mutable local rows', () => {
    const row = {nested: {values: [1, 2]}, binary: new Uint8Array([3, 4])};
    const anchor = snapshotTransportValue(row);
    expect(deepEqualTransport(row, anchor)).toBe(true);
    row.nested.values[0] = 9;
    row.binary[0] = 9;
    expect(anchor).toEqual({nested: {values: [1, 2]}, binary: new Uint8Array([3, 4])});
    expect(deepEqualTransport(row, anchor)).toBe(false);
  });
});
