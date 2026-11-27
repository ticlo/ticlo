import {expect} from 'vitest';
import {SchedulerEvent} from '../SchedulerEvent.ts';
import {ScheduleFunction} from '../Scheduler.ts';
import {DateTime} from 'luxon';
import {toDateTime} from '../../../../util/DateTime.ts';
import {updateGlobalSettings} from '../../../../util/Settings.ts';
import {DataWrapper} from '../../../../block/FunctonData.ts';
import {Root} from '../../../../block/Flow.ts';
import '../../../../index.ts';

describe('ScheduleEvent', function () {
  afterEach(() => {
    updateGlobalSettings();
  });
  it('parse', function () {
    let event = SchedulerEvent.fromProperty({repeat: 'daily', start: '1:23', duration: 60});
    expect(event.repeat).toBe('daily');
    expect(event.start).toEqual([1, 23]);
    expect(event.durationMs).toEqual(3599_999);

    event = SchedulerEvent.fromProperty({repeat: 'weekly', start: '2:34', wDays: [1, 3, 5], duration: 60});
    expect(event.wDays).toEqual([1, 3, 5]);
  });

  it('parse invalid', function () {
    let event = SchedulerEvent.fromProperty({repeat: 'daily', start: '999:23', duration: 60});
    expect(event).toBeNull();

    event = SchedulerEvent.fromProperty({repeat: 'weekly', start: '2:34', wDays: [0, 1], duration: 60});
    expect(event).toBeNull();

    event = SchedulerEvent.fromProperty({repeat: 'monthly', start: '3:45', mDays: [2, 12, 22, 32], duration: 60});
    expect(event).toBeNull();
  });

  it('next event', function () {
    const event = SchedulerEvent.fromProperty({repeat: 'daily', start: '12:20', duration: 60});
    const occur1 = event.getOccur(new Date('2024-01-01').getTime());
    expect(occur1.start).toBe(new Date('2024-01-01T12:20').getTime());

    const occur2 = event.getOccur(new Date('2024-01-01T11:00').getTime());
    expect(occur2).toBe(occur1); // not changed

    const occur3 = event.getOccur(new Date('2024-01-01T12:30').getTime());
    expect(occur3).toBe(occur1); // not changed

    // next
    const occur4 = event.getOccur(new Date('2024-01-01T13:20').getTime());
    expect(occur4.start).toBe(new Date('2024-01-02T12:20').getTime());
  });

  it('duration overflow', function () {
    const event = SchedulerEvent.fromProperty({repeat: 'daily', start: '0:0', duration: 3000});
    const occur1 = event.getOccur(DateTime.fromISO('2024-01-01').valueOf());
    expect(occur1.start).toBe(DateTime.fromISO('2024-01-01T00:00').valueOf());

    // when duration pass the next start, it should end before the next start
    expect(occur1.end - occur1.start).toBe(3600_000 * 24 - 1);

    const occur2 = event.getOccur(new Date('2024-01-02T00:00').getTime());
    expect(occur2.start).toBe(DateTime.fromISO('2024-01-02T00:00').valueOf());
  });

  it('after', function () {
    const event = SchedulerEvent.fromProperty({
      repeat: 'daily',
      start: '12:10',
      duration: 90,
      after: DateTime.fromISO('2024-01-05'),
    });
    const occur1 = event.getOccur(DateTime.fromISO('2024-01-01').valueOf());
    expect(occur1.start).toBe(DateTime.fromISO('2024-01-05T12:10').valueOf());

    const occur2 = event.getOccur(DateTime.fromISO('2024-01-07').valueOf());
    expect(occur2.start).toBe(DateTime.fromISO('2024-01-07T12:10').valueOf());
  });

  it('before', function () {
    const event = SchedulerEvent.fromProperty({
      repeat: 'daily',
      start: '12:10',
      duration: 90,
      before: DateTime.fromISO('2024-01-05'),
    });
    const occur1 = event.getOccur(DateTime.fromISO('2024-01-01').valueOf());
    expect(occur1.start).toBe(DateTime.fromISO('2024-01-01T12:10').valueOf());

    const occur2 = event.getOccur(DateTime.fromISO('2024-01-07').valueOf());
    expect(occur2.start).toBe(Infinity);
  });

  it('validates start time, duration and invalid after/before', function () {
    expect(SchedulerEvent.fromProperty({repeat: 'daily', start: '24:00', duration: 60})).toBeNull();
    expect(SchedulerEvent.fromProperty({repeat: 'daily', start: '12:60', duration: 60})).toBeNull();
    expect(SchedulerEvent.fromProperty({repeat: 'daily', start: '12:00', duration: Infinity})).toBeNull();
    expect(SchedulerEvent.fromProperty({repeat: 'daily', start: '12:00'})).toBeNull();
    expect(
      SchedulerEvent.fromProperty({repeat: 'daily', start: '12:00', duration: 60, after: DateTime.invalid('bad')})
    ).toBeNull();
  });

  it('falls back empty/auto/Factory timezone to global default zone', function () {
    updateGlobalSettings(new DataWrapper({'#timezone': 'America/New_York'}));
    for (const tz of [undefined, '', 'auto', 'Factory']) {
      const event = SchedulerEvent.fromProperty({repeat: 'daily', start: '0:0', duration: 0}, tz);
      expect(event.timezone).toBe('America/New_York');
      const refTs = DateTime.fromISO('2024-05-28T12:00:00', {zone: 'America/New_York'}).valueOf();
      const occur = event.getOccur(refTs);
      expect(occur.start).toBe(DateTime.fromISO('2024-05-28T00:00:00', {zone: 'America/New_York'}).valueOf());
    }
  });

  it('handles full-day events with after and end-of-day timestamp', function () {
    const zone = 'America/New_York';
    const event = SchedulerEvent.fromProperty(
      {
        repeat: 'daily',
        start: '0:0',
        duration: 0,
        after: DateTime.fromISO('2024-01-05T10:00:00', {zone}),
      },
      zone
    );
    const occur1 = event.getOccur(DateTime.fromISO('2024-01-01T00:00:00', {zone}).valueOf());
    expect(occur1.start).toBe(DateTime.fromISO('2024-01-05T10:00:00', {zone}).valueOf());
    expect(occur1.end).toBe(DateTime.fromISO('2024-01-05T23:59:59.999', {zone}).valueOf());

    // At 23:59:59.999 on the same day, the full-day event must still be matched.
    const eodEvent = SchedulerEvent.fromProperty({repeat: 'daily', start: '0:0', duration: 0}, zone);
    const eodTs = DateTime.fromISO('2024-01-05T23:59:59.999', {zone}).valueOf();
    const occurEod = eodEvent.getOccur(eodTs);
    expect(occurEod.start).toBe(DateTime.fromISO('2024-01-05T00:00:00', {zone}).valueOf());
    expect(occurEod.end).toBe(eodTs);
  });

  it('sorts unsorted wDays and dates', function () {
    const zone = 'UTC';
    const weekly = SchedulerEvent.fromProperty({repeat: 'weekly', start: '9:0', duration: 60, wDays: [5, 1, 5]}, zone);
    expect(weekly.wDays).toEqual([1, 5]);
    const monTs = DateTime.fromISO('2024-01-01T08:00:00', {zone}).valueOf(); // 2024-01-01 is Monday
    expect(weekly.getOccur(monTs).start).toBe(DateTime.fromISO('2024-01-01T09:00:00', {zone}).valueOf());

    const datesEvent = SchedulerEvent.fromProperty(
      {repeat: 'dates', start: '9:0', duration: 60, dates: ['2024-05-10', '2024-05-02', '2024-05-10']},
      zone
    );
    expect(datesEvent.dates.map((d) => d.toISODate())).toEqual(['2024-05-02', '2024-05-10']);
    const may1Ts = DateTime.fromISO('2024-05-01T00:00:00', {zone}).valueOf();
    expect(datesEvent.getOccur(may1Ts).start).toBe(DateTime.fromISO('2024-05-02T09:00:00', {zone}).valueOf());
  });

  it('handles advanced future years, missing days with range, and negative dayCount', function () {
    const zone = 'UTC';
    const futureEvent = SchedulerEvent.fromProperty(
      {repeat: 'advanced', start: '8:0', duration: 60, years: [2050], months: [6], days: [15]},
      zone
    );
    const occur2050 = futureEvent.getOccur(DateTime.fromISO('2024-01-01T00:00:00', {zone}).valueOf());
    expect(occur2050.start).toBe(DateTime.fromISO('2050-06-15T08:00:00', {zone}).valueOf());

    const rangeNoDays = SchedulerEvent.fromProperty(
      {repeat: 'advanced', start: '8:0', duration: 60, range: true},
      zone
    );
    expect(rangeNoDays).not.toBeNull();
    expect(() => rangeNoDays.getOccur(DateTime.fromISO('2024-01-01T00:00:00', {zone}).valueOf())).not.toThrow();

    const negOutOfRange = SchedulerEvent.fromProperty(
      {repeat: 'advanced', start: '8:0', duration: 60, years: [2024], months: [2], days: ['-9>1']},
      zone
    );
    expect(negOutOfRange.getOccur(DateTime.fromISO('2024-02-01T00:00:00', {zone}).valueOf()).start).toBe(Infinity);
  });
});

describe('ScheduleFunction', function () {
  it('rebuilds events on timezone change, maps valueN by index, handles min/max string numbers, and cancels stale schedule', function () {
    const flow = Root.instance.addFlow('testSchedulerFlow');
    try {
      const block = flow.createBlock('sched');
      block.setValue('#is', 'scheduler');
      block.setValue('[]', 2);
      // config0 is intentionally missing/invalid so event0 is skipped while event1 is at index 1
      block.setValue('config1', {repeat: 'daily', start: '10:00', duration: 120});
      block.setValue('value1', 'initial');
      block.setValue('default', 'fallback');
      block.setValue('timezone', 'UTC');
      block.setValue('lockTime', DateTime.fromISO('2024-05-28T10:30:00', {zone: 'UTC'}));
      Root.run();

      expect(block.getValue('#output')).toBe('initial');

      // Update value1 while config0 is invalid
      block.setValue('value1', 'updated');
      Root.run();
      expect(block.getValue('#output')).toBe('updated');

      // Change timezone: 10:30 UTC is 06:30 America/New_York (outside 10:00-12:00 EDT)
      block.setValue('timezone', 'America/New_York');
      Root.run();
      expect(block.getValue('#output')).toBe('fallback');

      // Test min mode nextTs with numeric strings ("2" vs "10")
      block.setValue('lockTime', undefined);
      block.setValue('resolveMode', 'min');
      block.setValue('timezone', 'UTC');
      const nowUtc = DateTime.now().setZone('UTC');
      const futureStart = nowUtc.plus({minutes: 10});
      const futureStartStr = `${futureStart.hour}:${futureStart.minute}`;
      block.setValue('config0', {repeat: 'daily', start: '0:0', duration: 0});
      block.setValue('value0', '10');
      block.setValue('config1', {repeat: 'daily', start: futureStartStr, duration: 30});
      block.setValue('value1', '2');
      Root.run();
      expect(block.getValue('#output')).toBe('10');
      const fn = (block as any)._function as ScheduleFunction;
      const expectedNext = futureStart.set({second: 0, millisecond: 0}).valueOf();
      expect(fn.getSchedule()?.start).toBe(expectedNext);

      // Override cancels active schedule
      block.setValue('override', 'manual');
      Root.run();
      expect(block.getValue('#output')).toBe('manual');
      expect(fn.getSchedule()).toBeNull();
    } finally {
      Root.instance.deleteValue('testSchedulerFlow');
    }
  });

  it('keeps wall-clock time for Factory after/before DateTimes while preserving explicit zones', function () {
    const zone = 'America/New_York';
    const factoryAfter = toDateTime('2024-01-05T10:00:00', 'Factory');
    const factoryEvent = SchedulerEvent.fromProperty(
      {repeat: 'daily', start: '0:0', duration: 0, after: factoryAfter},
      zone
    );
    expect(factoryEvent.after).toBe(DateTime.fromISO('2024-01-05T10:00:00', {zone}).valueOf());

    const utcAfter = DateTime.fromISO('2024-01-05T10:00:00', {zone: 'UTC'});
    const utcEvent = SchedulerEvent.fromProperty({repeat: 'daily', start: '0:0', duration: 0, after: utcAfter}, zone);
    expect(utcEvent.after).toBe(utcAfter.valueOf());
  });
});
