import {DateTime, Duration} from 'luxon';
import z from '../../../util/Validator';

const ONE_HOUR = 3600_000;
const ONE_MINUTE = 60_000;

export const RepeatModeList = [
  'daily',
  'weekly',
  'monthly',
  'advanced',
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
  priority?: number;
  // true for weekday, false for weekend, null for both
  isWeekDay?: boolean;
  // for daily, weekly
  days?: number[];
  // for advanced
  years?: number[];
  months?: number[];
  // for advanced
  monthDays?: number[];
  range?: boolean;
  // array of [year, month, day] that the special event may occur, must be sorted
  dates?: [number, number, number][];
}
const ConfigValidator = {
  name: z.nullable('string'),
  start: [23, 59],
  duration: Number.isInteger,
  after: z.nullable(z.datetime),
  before: z.nullable(z.datetime),
  priority: z.nullable(Number.isFinite),
  isWeekDay: z.nullable('boolean'),
  repeat: z.switch({
    daily: {},
    weekly: {days: [z.num1n(7)]},
    monthly: {days: [z.num1n(31)]},
    advanced: {
      years: z.nullable([z.num1n(31)]),
      months: z.nullable([z.num1n(12)]),
      monthDays: [z.any(z.num1n(31), ['number', z.num1n(7)])],
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
    public readonly priority?: number,
    // true for weekday, false for weekend, null for both
    public readonly isWeekDay?: boolean,
    // for daily, weekly
    public readonly days?: number[],
    // for advanced
    public readonly years?: number[],
    public readonly months?: number[],
    // since number for day, 2 numbers for nth weekday
    public readonly monthDays?: (number | [number, number])[],
    // nth weekday
    public readonly range?: boolean,

    // array of [year, month, day] that the special event may occur
    public readonly dates?: [number, number, number][]
  ) {}

  static fromProperty(config: unknown): ScheduleEvent {
    if (config) {
      if (z.check(config, ConfigValidator)) {
        const {
          name,
          start,
          duration,
          after,
          before,
          priority,
          isWeekDay,
          repeat,
          days,
          years,
          months,
          monthDays,
          range,
          dates,
        } = config as ScheduleConfig;
        return new ScheduleEvent(
          repeat,
          start,
          name,
          duration * ONE_MINUTE - 1,
          after?.valueOf() ?? -Infinity,
          before?.valueOf() ?? Infinity,
          priority ?? Infinity,
          isWeekDay,
          days,
          years,
          months,
          monthDays,
          range,
          dates
        );
      }
    }
    return null;
  }

  *#generateEvent(fromTs: number, timezone?: string): Generator<[number, number]> {
    let loopCount = 0;
    const checkAndYield = function* _checkAndYield(startDate: DateTime): Generator<[number, number]> {
      let startTs = startDate.valueOf();

      if (startDate.isWeekend === this.isWeekDay) {
        return;
      }
      loopCount = 0;
      if (this.durationMs < 0) {
        // end of day
        yield [startTs, startDate.set({hour: 23, minute: 59, second: 59, millisecond: 999}).valueOf()];
      }
      yield [startTs, startTs + this.durationMs];
    }.bind(this);

    function checkDeadLoop() {
      ++loopCount;
      return loopCount > 20;
    }

    let refDay = DateTime.fromMillis(fromTs, {zone: timezone}).set({
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    switch (this.repeat) {
      case 'daily': {
        while (true) {
          yield* checkAndYield(refDay.set({hour: this.start[0], minute: this.start[1]}));
          refDay = refDay.plus({day: 1});
          if (checkDeadLoop()) {
            return;
          }
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'weekly': {
        while (true) {
          for (const weekday of this.days) {
            yield* checkAndYield(refDay.set({weekday: weekday as any, hour: this.start[0], minute: this.start[1]}));
          }
          refDay = refDay.plus({week: 1});
          if (checkDeadLoop()) {
            return;
          }
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
              yield* checkAndYield(result);
            }
          }
          refDay = refDay.plus({month: 1});
          if (checkDeadLoop()) {
            return;
          }
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'dates': {
        for (let [year, month, day] of this.dates) {
          yield* checkAndYield(
            DateTime.fromObject({year, month, day, hour: this.start[0], minute: this.start[1]}, {zone: timezone})
          );
        }
        return;
      }
      case 'advanced': {
        for (let year = refDay.year; true; ++year) {
          if (checkDeadLoop()) {
            return;
          }
          if (!this.years?.length || this.years.includes(year)) {
            continue;
          }
          for (let month = 1; month <= 12; ++month) {
            if (!this.months?.length || this.months.includes(month)) {
              continue;
            }
            const startOfMonth = DateTime.fromObject({year, month, day: 1}, {zone: timezone});
            const endOfMonth = startOfMonth.endOf('month');
            const lastDay = endOfMonth.day;
            const days: number[] = [];
            for (let v of this.monthDays) {
              if (typeof v === 'number') {
                if (v >= 1 && v <= 31) {
                  // check for 31 instead of lastDay, because overflow is allowed in range mode
                  days.push(v);
                }
                return;
              }

              // check nth weekday
              if (Array.isArray(v) && (v as unknown[]).length === 2) {
                let targetDay = -1;
                const [weekCount, weekDay] = v as [number, number];
                if (weekCount === 0) {
                  // 0 for every week
                  let day = 1 + ((weekDay + 7 - startOfMonth.weekday) % 7);
                  for (; day <= lastDay; day += 7) {
                    days.push(targetDay);
                  }
                } else if (weekCount > 0) {
                  targetDay = 1 + (weekCount - 1) * 7 + ((weekDay + 7 - startOfMonth.weekday) % 7);
                } else if (weekCount < 0) {
                  targetDay = lastDay + (weekCount + 1) * 7 - ((endOfMonth.weekday + 7 - weekDay) % 7);
                }
                if (targetDay >= 1 && targetDay <= lastDay) {
                  days.push(targetDay);
                }
              }
            }
            if (this.range) {
              if (days.length === 2) {
                let [min, max] = days.sort();
                if (max > lastDay) {
                  if (min > lastDay) {
                    // invalid range
                    continue;
                  }
                  max = lastDay;
                }
                for (let day = min; day <= max; day++) {
                  yield* checkAndYield(startOfMonth.set({day}));
                }
              } // else { the range doesn't exist for this month }
            } else {
              const uniqueDays = [...new Set(days)].sort();
              for (let day of uniqueDays) {
                if (day <= lastDay) {
                  yield* checkAndYield(startOfMonth.set({day}));
                }
              }
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
