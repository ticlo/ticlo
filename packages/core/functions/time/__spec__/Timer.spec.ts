import {expect} from 'vitest';
import {getNextAlignedMinute, getNextAlignedSecond} from '../Timer.js';
import {DateTime} from 'luxon';

const ONE_MINUTE = 60_000;
const TWO_MINUTES = ONE_MINUTE * 2;
const SEVEN_MINUTES = ONE_MINUTE * 7;
const FIFTEEN_MINUTES = ONE_MINUTE * 15;
const ONE_HOUR = ONE_MINUTE * 60;

describe('Timer', function () {
  it('getNextAlignedMinute', function () {
    // aligned to 15 minutes
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:00:00.000'), FIFTEEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:15:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:13:59.999'), FIFTEEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:15:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:15:00.000'), FIFTEEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:30:00.000')
    );

    // aligned to 1 minute
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:00:00.000'), SEVEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:07:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:00:59.999'), SEVEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:07:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:01:00.000'), SEVEN_MINUTES, '')).toBe(
      +DateTime.fromISO('2024-01-01T00:08:00.000')
    );

    // aligned to 1 hour
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:00:00.000'), ONE_HOUR, '')).toBe(
      +DateTime.fromISO('2024-01-01T01:00:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T01:00:00.000'), ONE_HOUR * 2, '')).toBe(
      +DateTime.fromISO('2024-01-01T03:00:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T23:00:00.000'), ONE_HOUR * 25, '')).toBe(
      +DateTime.fromISO('2024-01-03T00:00:00.000')
    );
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:59:59.999'), ONE_HOUR * 24, '')).toBe(
      +DateTime.fromISO('2024-01-02T00:00:00.000')
    );
  });

  it('getNextAlignedMinute timezone', function () {
    // aligned to one hour should have 45 minutes difference
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:00:00.000'), ONE_HOUR, 'Australia/Eucla')).toBe(
      +DateTime.fromISO('2024-01-01T00:15:00.000')
    );
    // 15:00 Pacific time is same as 00:00 Eccla time
    expect(getNextAlignedMinute(+DateTime.fromISO('2024-01-01T00:14:59.000'), TWO_MINUTES, 'Australia/Eucla')).toBe(
      +DateTime.fromISO('2024-01-01T00:15:00.000')
    );
  });

  it('getNextAlignedSecond', function () {
    // aligned to 2 seconds
    expect(getNextAlignedSecond(0, 2000)).toBe(2000);
    expect(getNextAlignedSecond(1999, 2000)).toBe(2000);
    expect(getNextAlignedSecond(2000, 2000)).toBe(4000);

    // aligned to 1 second
    expect(getNextAlignedSecond(0, 7000)).toBe(7000);
    expect(getNextAlignedSecond(999, 7000)).toBe(7000);
    expect(getNextAlignedSecond(1000, 7000)).toBe(8000);
    expect(getNextAlignedSecond(1999, 7000)).toBe(8000);
  });
});
