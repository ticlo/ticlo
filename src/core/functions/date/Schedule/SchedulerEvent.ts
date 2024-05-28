import {DateTime, Duration} from 'luxon';
import z from '../../../util/Validator';

const ONE_MINUTE = 60_000;

export const RepeatModeList = [
  'daily',
  'weekly',
  'dates', // repeat on special dates
  'advanced',
] as const;
export type RepeatMode = (typeof RepeatModeList)[number];

export interface SchedulerConfig {
  repeat: RepeatMode;
  start: string; // hour:minute
  name?: string;
  duration?: number; // duration in minutes
  after?: DateTime;
  before?: DateTime;
  priority?: number;
  // true for weekday, false for weekend, null for both
  onlyWeekday?: boolean;
  // weekly
  wDays?: number[];
  // for advanced
  years?: number[];
  months?: number[];
  // for advanced
  days?: (number | string)[];
  range?: boolean;
  // array of year-month-day that the special event may occur, must be sorted
  dates?: string[];
  color?: string;
  key?: string;
}

function convertDay(v: number | string): number | [number, number] {
  if (typeof v === 'number') {
    return v;
  }
  if (typeof v === 'string') {
    return v.split('>').map(parseFloat) as [number, number];
  }
  return 0;
}

const ConfigValidator = {
  name: z.nullable('string'),
  start: z.nullable(/^\d{1,2}:\d{1,2}$/),
  duration: z.notNegative,
  after: z.nullable(z.datetime),
  before: z.nullable(z.datetime),
  priority: z.nullable(Number.isFinite),
  onlyWeekday: z.nullable('boolean'),
  repeat: z.switch({
    daily: {},
    weekly: {wDays: [z.num1n(7)]},
    advanced: {
      years: z.nullable([Number.isInteger]),
      months: z.nullable([z.num1n(12)]),
      days: z.nullable([z.any(z.num1n(31), /^-?\d>\d$/)]),
    },
    dates: {dates: [/^\d{4}-\d{2}-\d{2}$/]},
  }),
  color: z.nullable('string'),
  key: z.nullable('string'),
};
export function validateEventConfig(config: unknown) {
  return z.check(config, ConfigValidator);
}

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
export class SchedulerEvent {
  readonly repeat: RepeatMode;
  readonly start: [number, number]; // hour, minute
  readonly name?: string;
  readonly durationMs?: number; // duration in ms, -1 for full day
  readonly after?: number;
  readonly before?: number;
  // default 0
  readonly priority?: number;
  // true for weekday, false for weekend, null for both
  readonly onlyWeekday?: boolean;
  // weekly
  readonly wDays?: number[];
  // for advanced
  readonly years?: number[];
  readonly months?: number[];
  // since number for day, 2 numbers for nth weekday
  readonly days?: (number | [number, number])[];
  // dates mode and advanced mode, when there are only 2 input
  readonly range?: boolean;

  // array of [year, month, day] that the special event may occur
  readonly dates?: DateTime[];
  readonly color?: string;
  readonly key?: string;

  readonly timezone?: string;

  constructor(config: SchedulerConfig, timezone?: string) {
    this.repeat = config.repeat;
    this.start = (config.start?.split(':').map(Number.parseFloat) as [number, number]) ?? [0, 0];
    this.name = config.name;
    this.durationMs = config.duration * ONE_MINUTE - 1;
    this.after = config.after?.valueOf() ?? -Infinity;
    this.before = config.before?.valueOf() ?? Infinity;
    this.priority = config.priority ?? Infinity;
    this.onlyWeekday = config.onlyWeekday;
    this.wDays = config.wDays;
    this.years = config.years;
    this.months = config.months;
    this.days = config.days?.map(convertDay);
    this.range = Boolean(config.range);
    this.dates = config.dates?.map((s) =>
      DateTime.fromISO(s, {zone: timezone}).set({hour: this.start[0], minute: this.start[1]})
    );
    this.color = config.color;
    this.key = config.key;
    this.timezone = timezone;
  }

  static fromProperty(config: unknown, timezone?: string): SchedulerEvent {
    if (config) {
      if (validateEventConfig(config)) {
        return new SchedulerEvent(config as SchedulerConfig, timezone);
      }
    }
    return null;
  }

  *#generateEvent(fromTs: number): Generator<[number, number]> {
    let loopCount = 0;
    const checkAndYield = function* _checkAndYield(startDate: DateTime): Generator<[number, number]> {
      let startTs = startDate.valueOf();

      if (startDate.isWeekend === this.onlyWeekday) {
        return;
      }
      loopCount = 0;
      if (this.durationMs <= 0) {
        // end of day
        yield [startTs, startDate.set({hour: 23, minute: 59, second: 59, millisecond: 999}).valueOf()];
      } else {
        yield [startTs, startTs + this.durationMs];
      }
    }.bind(this);

    function checkDeadLoop() {
      ++loopCount;
      return loopCount > 20;
    }

    let refDay = DateTime.fromMillis(fromTs, {zone: this.timezone}).set({
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
          for (const weekday of this.wDays) {
            yield* checkAndYield(refDay.set({weekday: weekday as any, hour: this.start[0], minute: this.start[1]}));
          }
          refDay = refDay.plus({week: 1});
          if (checkDeadLoop()) {
            return;
          }
        }
      }
      // tslint:disable-next-line:no-switch-case-fall-through
      case 'dates': {
        for (let d of this.dates) {
          yield* checkAndYield(d);
        }
        return;
      }
      case 'advanced': {
        for (let year = refDay.year; true; ++year) {
          if (checkDeadLoop()) {
            return;
          }
          if (this.years?.length && !this.years.includes(year)) {
            continue;
          }
          for (let month = 1; month <= 12; ++month) {
            if (this.months?.length && !this.months.includes(month)) {
              continue;
            }
            const startOfMonth = DateTime.fromObject({year, month, day: 1}, {zone: this.timezone});
            const endOfMonth = startOfMonth.endOf('month');
            const lastDay = endOfMonth.day;
            const days: number[] = [];
            const daysConfig = this.days?.length ? this.days : [[0, 0]];
            loop: for (let v of daysConfig) {
              if (typeof v === 'number') {
                if (v >= 1 && v <= 31) {
                  // check for 31 instead of lastDay, because overflow is allowed in range mode
                  days.push(v);
                } else if (v === -1) {
                  // last day
                  days.push(endOfMonth.day);
                }
              } else if (Array.isArray(v) && (v as unknown[]).length === 2) {
                // check nth weekday
                let targetDay = -1;
                const [dayCount, dayType] = v as [number, number];
                let isDayTypeWeekend = false;
                switch (dayType) {
                  case 0: // any day
                    if (dayCount === 0) {
                      for (let i = 1; i <= lastDay; ++i) {
                        days.push(i);
                      }
                      break loop;
                    }
                    if (dayCount > 0) {
                      days.push(dayCount);
                    } else if (dayCount < 0) {
                      // the last nth day
                      days.push(lastDay + 1 + dayCount);
                    }
                    break;
                  case 9: // non-week day
                    isDayTypeWeekend = true;
                  // tslint:disable-next-line:no-switch-case-fall-through
                  case 8: // week day
                    if (dayCount === 0) {
                      for (let i = 1; i <= lastDay; ++i) {
                        let targetDay = startOfMonth.set({day: i, hour: this.start[0], minute: this.start[1]});
                        if (targetDay.isWeekend === isDayTypeWeekend) {
                          days.push(i);
                        }
                      }
                    } else if (dayCount > 0) {
                      let counter = 0;
                      for (let i = 1; i <= lastDay; ++i) {
                        let targetDay = startOfMonth.set({day: i, hour: this.start[0], minute: this.start[1]});
                        if (targetDay.isWeekend === isDayTypeWeekend) {
                          counter++;
                          if (counter === dayCount) {
                            days.push(i);
                            break;
                          }
                        }
                      }
                    } else if (dayCount < 0) {
                      let counter = 0;
                      for (let i = lastDay; i >= 1; --i) {
                        let targetDay = startOfMonth.set({day: i, hour: this.start[0], minute: this.start[1]});
                        if (targetDay.isWeekend === isDayTypeWeekend) {
                          counter--;
                          if (counter === dayCount) {
                            days.push(i);
                            break;
                          }
                        }
                      }
                    }
                    break;
                  default: // 1~7
                    if (dayCount === 0) {
                      // 0 for every week
                      let day = 1 + ((dayType + 7 - startOfMonth.weekday) % 7);
                      for (; day <= lastDay; day += 7) {
                        days.push(day);
                      }
                    } else if (dayCount > 0) {
                      targetDay = 1 + (dayCount - 1) * 7 + ((dayType + 7 - startOfMonth.weekday) % 7);
                    } else if (dayCount < 0) {
                      targetDay = lastDay + (dayCount + 1) * 7 - ((endOfMonth.weekday + 7 - dayType) % 7);
                    }
                    if (targetDay >= 1 && targetDay <= lastDay) {
                      days.push(targetDay);
                    }
                }
              }
            }
            if (this.range && this.days.length === 2) {
              if (days.length === 2) {
                let [min, max] = days.sort((a, b) => a - b);
                if (max > lastDay) {
                  if (min > lastDay) {
                    // invalid range
                    continue;
                  }
                  max = lastDay;
                }
                for (let day = min; day <= max; day++) {
                  yield* checkAndYield(startOfMonth.set({day, hour: this.start[0], minute: this.start[1]}));
                }
              } // else { the range doesn't exist for this month }
            } else {
              // remove duplicated days
              const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
              for (let day of uniqueDays) {
                if (day <= lastDay) {
                  yield* checkAndYield(startOfMonth.set({day, hour: this.start[0], minute: this.start[1]}));
                }
              }
            }
          }
        }
      }
    }
  }

  #current: EventOccur;
  getOccur(ts: number): EventOccur {
    if (ts > this.before) {
      return expired;
    }
    if (this.#current && this.#current.end >= ts) {
      return this.#current;
    }

    let current: EventOccur;

    let fromTs = ts;
    if (this.after > ts) {
      fromTs = this.after;
    }

    for (let [startTs, endTs] of this.#generateEvent(fromTs - this.durationMs)) {
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
        current = new EventOccur(startTs, endTs);
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
      this.#current = current;
    } else {
      this.#current = expired;
    }
    return this.#current;
  }
  clearCache() {
    this.#current = null;
  }
}
