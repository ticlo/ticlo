import {DateTime} from 'luxon';
import vl from '../../../util/Validator.ts';
import {isWeekDay} from '../../../util/Settings.ts';
import {resolveZone, toDateTime} from '../../../util/DateTime.ts';

const ONE_MINUTE = 60_000;

export const RepeatModeList = [
  'daily',
  'weekly',
  'dates', // repeat on special dates
  'advanced',
] as const;
export type RepeatMode = (typeof RepeatModeList)[number];

/**
 * Configuration interface for a scheduler event.
 * Defines how an event repeats, its timing, priority, and other metadata.
 * This is the JSON serializable representation of an event.
 */

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

function validateStartTime(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{1,2}:\d{1,2}$/.test(v)) {
    return false;
  }
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

const ConfigValidator = {
  name: vl.nullable('string'),
  start: vl.nullable(validateStartTime),
  duration: (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  after: vl.nullable((v) => DateTime.isDateTime(v) && v.isValid),
  before: vl.nullable((v) => DateTime.isDateTime(v) && v.isValid),
  priority: vl.nullable(Number.isFinite),
  onlyWeekday: vl.nullable('boolean'),
  repeat: vl.switch({
    daily: {},
    weekly: {wDays: [vl.num1n(7)]},
    advanced: {
      years: vl.nullable([Number.isInteger]),
      months: vl.nullable([vl.num1n(12)]),
      days: vl.nullable([vl.any(vl.num1n(31), /^-?\d>\d$/)]),
    },
    dates: {dates: [/^\d{4}-\d{2}-\d{2}$/]},
  }),
  color: vl.nullable('string'),
};
/**
 * Validates a raw event configuration object against the schema.
 * Returns true if valid, throws error otherwise (via vl.check).
 */
export function validateEventConfig(config: unknown) {
  return vl.check(config, ConfigValidator);
}

/**
 * Represents a specific occurrence of an event, with a start and end timestamp.
 */
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

/**
 * The runtime representation of a scheduler event.
 * Parses the configuration and provides methods to calculate event occurrences.
 */
export class SchedulerEvent {
  readonly repeat: RepeatMode;
  readonly start: [number, number]; // hour, minute
  readonly name?: string;
  readonly durationMs?: number; // duration in ms, -1 for full day
  readonly after?: number;
  readonly before?: number;
  // lower number = higher priority; default Infinity (lowest)
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

  readonly timezone: string;

  constructor(config: SchedulerConfig, timezone?: string) {
    const resolvedZone = resolveZone(timezone);
    this.repeat = config.repeat;
    this.start = config.start ? (config.start.split(':').map(Number) as [number, number]) : [0, 0];
    this.name = config.name;
    this.durationMs = config.duration * ONE_MINUTE - 1;
    this.after = config.after?.isValid ? toDateTime(config.after, resolvedZone).valueOf() : -Infinity;
    this.before = config.before?.isValid ? toDateTime(config.before, resolvedZone).valueOf() : Infinity;
    this.priority = config.priority ?? Infinity;
    this.onlyWeekday = config.onlyWeekday;
    this.wDays = config.wDays ? [...new Set(config.wDays)].sort((a, b) => a - b) : undefined;
    this.years = config.years ? [...new Set(config.years)].sort((a, b) => a - b) : undefined;
    this.months = config.months ? [...new Set(config.months)].sort((a, b) => a - b) : undefined;
    this.days = config.days?.map(convertDay);
    this.range = Boolean(config.range);
    this.dates = config.dates
      ? [...new Set(config.dates)]
          .sort()
          .map((s) => DateTime.fromISO(s, {zone: resolvedZone}).set({hour: this.start[0], minute: this.start[1]}))
      : undefined;
    this.color = config.color;
    this.timezone = resolvedZone;
  }

  static fromProperty(config: unknown, timezone?: string): SchedulerEvent {
    if (config) {
      if (validateEventConfig(config)) {
        return new SchedulerEvent(config as SchedulerConfig, timezone);
      }
    }
    return null;
  }

  /**
   * A generator that yields event occurrences (start, end) starting from a given timestamp.
   * This handles all recurrence logic: daily, weekly, specific dates, and advanced patterns.
   *
   * @param fromTs The timestamp to start generating events from.
   */
  *_generateEvent(fromTs: number): Generator<[number, number]> {
    let loopCount = 0;
    // Helper to yield an event if it matches criteria (e.g. weekday check)
    const checkAndYield = function* _checkAndYield(startDate: DateTime): Generator<[number, number]> {
      const startTs = startDate.valueOf();

      // this.onlyWeekday could be null, so do not use !==
      if (!isWeekDay(startDate.weekday) === this.onlyWeekday) {
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

    // Safety mechanism to prevent infinite loops if a configuration yields no valid dates for a long period.
    // e.g., "Feb 30th" or filters that exclude all possibilities.
    function checkDeadLoop() {
      ++loopCount;
      return loopCount > 20;
    }

    // Initialize the reference day.
    // We normalize to noon (12:00) to avoid DST boundary issues when adding days/weeks,
    // ensuring we stay on the correct calendar day.
    let refDay = DateTime.fromMillis(fromTs, {zone: this.timezone}).set({
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    if (!refDay.isValid) {
      yield [Infinity, Infinity];
      return;
    }
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
      case 'dates': {
        for (const d of this.dates) {
          yield* checkAndYield(d);
        }
        return;
      }
      case 'advanced': {
        // Advanced mode: explicit control over years, months, and days.
        const yearsIter = this.years?.length ? this.years : null;
        let yearIdx = 0;
        for (let year = refDay.year; true;) {
          if (yearsIter) {
            while (yearIdx < yearsIter.length && yearsIter[yearIdx] < refDay.year) {
              yearIdx++;
            }
            if (yearIdx >= yearsIter.length) {
              return;
            }
            year = yearsIter[yearIdx++];
          } else if (checkDeadLoop()) {
            return;
          }
          const startMonth = year === refDay.year ? refDay.month : 1;
          // Then by month:
          for (let month = startMonth; month <= 12; ++month) {
            if (this.months?.length && !this.months.includes(month)) {
              continue;
            }
            // Construct the month context
            const startOfMonth = DateTime.fromObject({year, month, day: 1}, {zone: this.timezone});
            const endOfMonth = startOfMonth.endOf('month');
            const lastDay = endOfMonth.day;
            const startWeekday = startOfMonth.weekday;
            const days: number[] = [];

            // Resolve the specific days within this month based on configuration.
            // Configurations can be simple numbers (1-31), or complex rules like "last day" (-1>0)
            // or "nth weekday" (e.g. 2nd Friday).
            const daysConfig = this.days?.length ? this.days : [[0, 0]];
            loop: for (const v of daysConfig) {
              if (typeof v === 'number') {
                if (v >= 1 && v <= 31) {
                  // check for 31 instead of lastDay, because overflow is allowed in range mode
                  days.push(v);
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
                  case 8: {
                    // week day
                    if (dayCount === 0) {
                      for (let i = 1; i <= lastDay; ++i) {
                        const wd = ((startWeekday - 1 + (i - 1)) % 7) + 1;
                        if (isWeekDay(wd) !== isDayTypeWeekend) {
                          days.push(i);
                        }
                      }
                    } else if (dayCount > 0) {
                      let counter = 0;
                      for (let i = 1; i <= lastDay; ++i) {
                        const wd = ((startWeekday - 1 + (i - 1)) % 7) + 1;
                        if (isWeekDay(wd) !== isDayTypeWeekend) {
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
                        const wd = ((startWeekday - 1 + (i - 1)) % 7) + 1;
                        if (isWeekDay(wd) !== isDayTypeWeekend) {
                          counter--;
                          if (counter === dayCount) {
                            days.push(i);
                            break;
                          }
                        }
                      }
                    }
                    break;
                  }
                  default: // 1~7
                    if (dayCount === 0) {
                      // 0 for every week
                      let day = 1 + ((dayType + 7 - startWeekday) % 7);
                      for (; day <= lastDay; day += 7) {
                        days.push(day);
                      }
                    } else if (dayCount > 0) {
                      targetDay = 1 + (dayCount - 1) * 7 + ((dayType + 7 - startWeekday) % 7);
                    } else if (dayCount < 0) {
                      targetDay = lastDay + (dayCount + 1) * 7 - ((endOfMonth.weekday + 7 - dayType) % 7);
                    }
                    if (targetDay >= 1 && targetDay <= lastDay) {
                      days.push(targetDay);
                    }
                }
              }
            }
            if (this.range && this.days?.length === 2) {
              if (days.length === 2) {
                let [min, max] = days.sort((a, b) => a - b);
                if (min > lastDay || max < 1) {
                  // invalid range
                  continue;
                }
                if (min < 1) {
                  min = 1;
                }
                if (max > lastDay) {
                  max = lastDay;
                }
                for (let day = min; day <= max; day++) {
                  yield* checkAndYield(startOfMonth.set({day, hour: this.start[0], minute: this.start[1]}));
                }
              } // else { the range doesn't exist for this month }
            } else {
              // remove duplicated days
              const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
              for (const day of uniqueDays) {
                if (day >= 1 && day <= lastDay) {
                  yield* checkAndYield(startOfMonth.set({day, hour: this.start[0], minute: this.start[1]}));
                }
              }
            }
          }
          if (!yearsIter) {
            ++year;
          }
        }
      }
    }
  }

  private _currentCheckTs: number;
  private _current: EventOccur;

  /**
   * Calculates the active or next occurrence of the event relative to the given timestamp.
   *
   * @param ts The reference timestamp
   * @returns An EventOccur object. If the event is active at `ts`, returns that occurrence.
   *          If not active, returns the next future occurrence.
   *          If no future occurrence exists, returns an "expired" occurrence (Infinity).
   */
  getOccur(ts: number): EventOccur {
    if (ts > this.before) {
      return expired;
    }
    if (this._current && ts >= this._currentCheckTs && this._current.end >= ts) {
      return this._current;
    }

    let current: EventOccur;

    let fromTs = ts;
    if (this.after > ts) {
      // optimization: if the event is constrained to start after a specific time, jump to it.
      fromTs = this.after;
    }

    // We start searching for events a bit *before* the target time `ts`.
    // Why? Because an event might have started before `ts` and is still ongoing (overlapping `ts`).
    // Example: Event is 10:00 -> 11:00. Request `getOccur(10:30)`.
    // If we generate starting from 10:30, we might get 10:30 (next, incorrect) or miss the start.
    // By backing up `lookbackMs`, we ensure we catch any event starting at [ts - duration, ts].
    // For full-day events (durationMs === -1), lookbackMs is 0 so we still start on the same day even at 23:59:59.999.
    const lookbackMs = this.durationMs > 0 ? this.durationMs : 0;
    for (const [startTs, endTs] of this._generateEvent(fromTs - lookbackMs)) {
      if (endTs < this.after) {
        // The event ends before it is allowed to start ('after' constraint), skip.
        continue;
      }
      if (endTs >= ts) {
        // Found a candidate that ends after or at the current time.
        if (current) {
          // If we already have a 'current' (which was created in a previous loop iteration but wasn't returned yet
          // because we peeked ahead), and now we found a *new* startTs > ts, it means:
          // 'current' handles the range around 'ts', and this new one is the NEXT occurrence.
          if (startTs > ts) {
            // Check for overlap between the current event and this next event.
            // If they overlap, trim the current one to end just before the next one starts.
            // This prevents overlapping occurrences of the same event definition.
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
      this._current = current;
    } else {
      this._current = expired;
    }
    this._currentCheckTs = ts;
    return this._current;
  }
}
