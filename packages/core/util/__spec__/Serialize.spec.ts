import {expect} from 'vitest';
import {encode, decode, encodeSorted, encodeDisplay, hashData} from '../Serialize.ts';
import {ErrorEvent, EventType} from '../../block/Event.ts';
import {DateTime} from 'luxon';
import {formatDate, isDateSame} from '../DateTime.ts';

describe('Serialize', function () {
  it('roundtrips error events compactly with native messages and codes, without stacks or loop IDs', () => {
    class DatabaseError extends Error {
      name = 'DatabaseError';
      code = 'SQLITE_ERROR';
    }
    const error = new DatabaseError('bad SQL: "select"\n͢Ts:literal');
    const event = new ErrorEvent(undefined, error);
    for (const serialize of [encode, encodeSorted]) {
      const wire = serialize({event, native: new TypeError('invalid input')});
      expect(wire).not.toContain('stack');
      expect(wire).not.toContain('loopId');
      const restored = decode(wire);
      expect(restored.event).toBeInstanceOf(ErrorEvent);
      expect(restored.event.check()).toBe(EventType.ERROR);
      expect(restored.event.type).toBe('error');
      expect(restored.event.detail).toBeInstanceOf(Error);
      expect(restored.event.detail).toMatchObject({
        name: 'DatabaseError',
        message: error.message,
        code: 'SQLITE_ERROR',
      });
      expect(restored.native).toMatchObject({name: 'TypeError', message: 'invalid input'});
    }
    expect(encode(new ErrorEvent(undefined, 'broken')).length).toBeLessThan(32);
    expect(decode(encode(new ErrorEvent())).type).toBe('error');
  });

  it('preserves explicit error types and structured or Arrow-prefixed details', () => {
    for (const detail of ['͢Ts:literal', {value: NaN, bytes: new Uint8Array([0, 255])}, undefined]) {
      const event = decode(encode(new ErrorEvent('timeout', detail)));
      expect(event).toBeInstanceOf(ErrorEvent);
      expect(event.type).toBe('timeout');
      expect(event.detail).toEqual(detail);
    }
  });

  it('hashes clipboard data consistently across key ordering and Arrow roundtrips', () => {
    const data = {
      '#_copy_from': 'Main.source',
      'a': {
        '#is': '',
        'date': DateTime.fromISO('2025-01-01T12:00:00.000Z', {setZone: true}),
        'values': [NaN, undefined, -Infinity, new Uint8Array([1, 2, 3])],
      },
    };
    const reordered = {'a': {'values': data.a.values, 'date': data.a.date, '#is': ''}, '#_copy_from': 'Main.source'};
    expect(hashData(reordered)).toBe(hashData(data));
    expect(hashData(decode(encode(data)))).toBe(hashData(data));
    expect(hashData({...data, '#_copy_from': 'Main.target'})).not.toBe(hashData(data));
    expect(hashData({...data, a: {...data.a, values: [...data.a.values].reverse()}})).not.toBe(hashData(data));
  });

  it('DateTime local', function () {
    const dateStr = '2014-11-27T11:07:00.000';
    const date = DateTime.fromISO(dateStr);
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:2014-11-27T11:07:00.000"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 PST');
    expect(formatDate(date, false)).toBe('2014-11-27');
    // decode from ISO format
    expect(isDateSame(date, decode(`"͢Ts:${dateStr}"`))).toBe(true);
  });
  it('DateTime tz', function () {
    const dateStr = '2014-11-27T11:07:00.000-03:00';
    const date = DateTime.fromISO(dateStr, {setZone: true});
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:2014-11-27T11:07:00.000@UTC-3"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('2014-11-27 11:07:00 UTC-3');
  });
  it('DateTime invalid', function () {
    const date = DateTime.invalid('test invalid');
    const encodedStr = encode(date);
    expect(encodedStr).toBe('"͢Ts:!test invalid"');
    expect(isDateSame(date, decode(encodedStr))).toBe(true);
    expect(encodeDisplay(date)).toBe('test invalid');
  });

  it('encodeDisplay', function () {
    expect(encodeDisplay(NaN)).toBe('NaN');
    expect(encodeDisplay(undefined)).toBe('undefined');
    expect(encodeDisplay(-Infinity)).toBe('-Inf');
  });

  it('day light saving', function () {
    const d7 = DateTime.fromISO('2024-11-03T01:30:21.123-07:00');
    const d8 = DateTime.fromISO('2024-11-03T01:30:21.123-08:00');
    const d7Encoded = encode(d7);
    const d8Encoded = encode(d8);
    expect(d7Encoded).toBe('"͢Ts:2024-11-03T01:30:21.123*"');
    expect(d8Encoded).toBe('"͢Ts:2024-11-03T01:30:21.123"');
    expect(isDateSame(d7, decode(d7Encoded))).toBe(true);
    expect(isDateSame(d8, decode(d8Encoded))).toBe(true);

    const s11 = DateTime.fromISO('2025-04-06T02:30:00.000+11:00', {zone: 'Australia/Sydney'});
    const s10 = DateTime.fromISO('2025-04-06T02:30:00.000+10:00', {zone: 'Australia/Sydney'});
    const s11Encoded = encode(s11);
    const s10Encoded = encode(s10);
    expect(s11Encoded).toBe('"͢Ts:2025-04-06T02:30:00.000*@Australia/Sydney"');
    expect(s10Encoded).toBe('"͢Ts:2025-04-06T02:30:00.000@Australia/Sydney"');
    expect(isDateSame(s11, decode(s11Encoded))).toBe(true);
    expect(isDateSame(s10, decode(s10Encoded))).toBe(true);
  });
});
