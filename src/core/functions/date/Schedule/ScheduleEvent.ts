import {DateTime, Duration} from 'luxon';
import z from '../../../util/Validator';

const ONE_HOUR = 3600_000;
const ONE_MINUTE = 60_000;

export const RepeatModeList = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'dates', // repeat on special dates
] as const;
export type RepeatMode = (typeof RepeatModeList)[number];

interface ScheduleConfig {
  repeat: RepeatMode;
  start: [number, number]; // hour, minute
  name?: string;
  duration?: number; // duration in minutes
  after?: DateTime;
  before?: DateTime;
  urgency?: number;
  // for daily, weekly
  days?: number[];
  // for yearly
  months?: number[];
  // for yearly
  monthDays?: number[];
  monthWeekDays?: [number, number][];
  // array of [year, month, day] that the special event may occur, must be sorted
  dates?: [number, number, number][];
}
const ConfigValidator = {
  name: z.nullable('string'),
  start: [23, 59],
  duration: Number.isInteger,
  after: z.nullable(z.datetime),
  before: z.nullable(z.datetime),
  urgency: z.nullable(Number.isFinite),
  repeat: z.switch({
    daily: {},
    weekly: {days: [z.num1n(7)]},
    monthly: {days: [z.num1n(31)]},
    yearly: {
      months: [z.num1n(12)],
      monthDays: [z.num1n(31)],
      monthWeekDays: [['number', z.num1n(7)]],
    },
    dates: {dates: [[z.int, z.num1n(12), z.num1n(31)]]},
  }),
};

export class EventOccur {
  constructor(
    public start: number,
    public end: number
  ) {}
  isValid() {
    return this.start < Infinity;
  }
}
const expired = new EventOccur(Infinity, Infinity);
export class ScheduleEvent {
  constructor(
    public readonly repeat: RepeatMode,
    public readonly start: [number, number], // hour, minute
    public readonly name?: string,
    public readonly durationMs?: number, // duration in ms, -1 for full day
    public readonly after?: number,
    public readonly before?: number,
    // default 0
    public readonly urgency?: number,

    // for daily, weekly
    public readonly days?: number[],
    // for yearly
    public readonly months?: number[],
    public readonly monthDays?: number[],
    // nth weekday
    public readonly monthWeekDays?: [number, number][],

    // array of [year, month, day] that the special event may occur
    public readonly dates?: [number, number, number][]
  ) {}

  static fromProperty(config: unknown): ScheduleEvent {
    if (config) {
      if (z.check(config, ConfigValidator)) {
        const {name, start, duration, after, before, urgency, repeat, days, months, monthDays, monthWeekDays, dates} =
          config as ScheduleConfig;
        return new ScheduleEvent(
          repeat,
          start,
          name,
          duration * ONE_MINUTE - 1,
          after?.valueOf() ?? -Infinity,
          before?.valueOf() ?? Infinity,
          urgency ?? 0,
          days,
          months,
          monthDays,
          monthWeekDays,
          dates
        );
      }
    }
    return null;
  }
  *#generateEvent(fromTs: number, timezone?: string): Generator<[number, number]> {
    const toRange = (startDate: DateTime): [number, number] => {
      let startTs = startDate.valueOf();
      if (this.durationMs < 0) {
        // end of day
        return [startTs, startDate.set({hour: 23, minute: 59, second: 59, millisecond: 999}).valueOf()];
      }
      return [startTs, startTs + this.durationMs];
    };
    let refDay = DateTime.fromMillis(fromTs, {zone: timezone}).set({
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    switch (this.repeat) {
      case 'daily': {
        while (true) {
          yield toRange(refDay.set({hour: this.start[0], minute: this.start[1]}));
          refDay = refDay.plus({day: 1});
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'weekly': {
        while (true) {
          for (const weekday of this.days) {
            yield toRange(refDay.set({weekday: weekday as any, hour: this.start[0], minute: this.start[1]}));
          }
          refDay = refDay.plus({week: 1});
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'monthly': {
        // move to first day
        refDay = refDay.set({day: 1});
        while (true) {
          for (const day of this.days) {
            const result = refDay.set({day: day as any, hour: this.start[0], minute: this.start[1]});
            if (result.month === refDay.month) {
              // make sure it doesn't fall to next month because of day number overflow
              yield toRange(result);
            }
          }
          refDay = refDay.plus({month: 1});
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'dates': {
        for (let [year, month, day] of this.dates) {
          yield toRange(
            DateTime.fromObject({year, month, day, hour: this.start[0], minute: this.start[1]}, {zone: timezone})
          );
        }
        return;
      }
      case 'yearly': {
        let year = refDay.year;
        for (let year = refDay.year; true; ++year) {
          for (let month = 1; month <= 12; ++month) {
            if (this.months.includes(month)) {
              const startOfMonth = DateTime.fromObject({year, month, day: 1}, {zone: timezone});
              const endOfMonth = startOfMonth.endOf('month');
              const days = this.monthDays.filter((v) => typeof v === 'number');
              for (let day = 1; day <= endOfMonth.day; ++day) {}
            }
          }
        }
      }
    }
  }

  #current: EventOccur;
  getOccur(ts: number, timezone?: string): EventOccur {
    if (this.#current && this.#current.end >= ts) {
      return this.#current;
    }

    let current: EventOccur;

    let fromTs = ts;
    if (this.after > ts) {
      fromTs = this.after;
    }

    for (let [startTs, endTs] of this.#generateEvent(fromTs - this.durationMs, timezone)) {
      if (this.after - startTs > this.durationMs) {
        continue;
      }
      if (endTs >= ts) {
        if (current) {
          if (startTs > ts) {
            // next one is in the future, the current can be returned
            if (startTs < current.end) {
              current.end = startTs - 1;
            }
            break;
          }
        }
        current = new EventOccur(startTs, startTs + this.durationMs);
      }
    }

    if (current) {
      if (this.after > current.start) {
        // event must start after the after value
        current.start = this.after;
      }
      // event must end before the before value
      if (current.start >= this.before) {
        current = expired;
      } else if (current.end > this.before) {
        current.end = this.before;
      }
    } else {
      this.#current = expired;
    }
    this.#current = current;
    return current;
  }
  clearCache() {
    this.#current = null;
  }
}
