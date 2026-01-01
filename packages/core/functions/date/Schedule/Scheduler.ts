import {Functions} from '../../../block/Functions.js';
import {AutoUpdateFunction} from '../../base/AutoUpdateFunction.js';
import {type EventOccur, SchedulerEvent} from './SchedulerEvent.js';
import {BlockIO} from '../../../block/BlockProperty.js';
import {toDateTime} from '../../../util/DateTime.js';
import {DateTime} from 'luxon';
import {getInputsArray} from '../../../block/FunctonData.js';
import {getDefaultZone} from '../../../util/Settings.js';

// Defines how multiple events are resolved when they overlap
export class ScheduleValue {
  /**
   * Compares two ScheduleValues to determines which one should take precedence.
   * Returns 1 if `a` generally replaces `b`, -1 otherwise.
   */
  static compare(a: ScheduleValue, b: ScheduleValue) {
    if (a.shouldReplace(b)) {
      return 1;
    }
    return -1;
  }

  occur: EventOccur;
  constructor(
    public readonly event: SchedulerEvent,
    public value: unknown,
    public index: number
  ) {}
  getOccur(ts: number): EventOccur {
    this.occur = this.event.getOccur(ts);
    return this.occur;
  }

  /**
   * Determines if this event should replace the `current` active event.
   * Based on priority (higher wins), start time (later wins if priority equal), and index (lower index wins if all else equal).
   */
  shouldReplace(current: ScheduleValue) {
    if (!current) {
      return true;
    }
    if (this.event.priority === current.event.priority) {
      if (this.occur.start === current.occur.start) {
        // when everything is same, lower index is more important
        return this.index < current.index;
      }
      return this.occur.start > current.occur.start;
    }
    return this.event.priority < current.event.priority;
  }
  shouldReplaceNext(current: ScheduleValue, next: ScheduleValue) {
    if (current) {
      // not need to check anything happens after current
      if (this.occur.start > current.occur.end) {
        return false;
      }
      // this need have higher priority, otherwise it still happens after current
      if (!this.shouldReplace(current)) {
        return false;
      }
    }
    if (next) {
      if (this.occur.start === next.occur.start) {
        return this.shouldReplace(next);
      }
      // logic: we only care about if this event starts *before* the next confirmed event.
      // If it starts before the next event, it has a chance to be the active event in that gap.
      return this.occur.start < next.occur.start;
    }
    // If no current and no next, this event is the best candidate so far.
    return true;
  }
}

/**
 * Scheduler Function
 *
 * This function manages time-based value scheduling. It allows users to define multiple "events",
 * each with a Schedule Configuration (when it happens) and a Value (what is output).
 * The function continuously updates its output based on the current time and the active events.
 *
 * algorithm Overview:
 * 1. Collects all events (config + value pairs) and the default value.
 * 2. Identifies which events are "active" at the current timestamp.
 * 3. Resolves conflicts if multiple events are active based on `resolveMode`.
 * 4. Outputs the final resolved value.
 * 5. Optimizes performance by calculating the exact `nextTs` (next timestamp) to wake up,
 *    avoiding unnecessary polling.
 *
 * Properties:
 * - [Group List]: Defines the schedule events.
 *   - `config`: The recurrence rule (Start time, Duration, Repeat mode: Daily/Weekly/etc, Priority).
 *   - `value`: The data to output when this event is active.
 * - `default`: The fallback value used when no events are active.
 * - `override`: A manual value that temporarily bypasses the schedule.
 *   - In 'overwrite' mode (default), this completely replaces the schedule output.
 *   - In 'merge' mode, this is merged into the result.
 * - `lockTime`: A fixed timestamp for debugging/previewing the schedule at a specific time.
 * - `resolveMode`: Strategy for handling overlapping active events:
 *   - 'overwrite': active event with highest priority wins. (Priority > Start Time > List Index)
 *   - 'merge': Merges objects/key-values from all active events (useful for configuration objects).
 *   - 'min': Selects the lowest numeric value among active events.
 *   - 'max': Selects the highest numeric value among active events.
 * - `timezone`: The specific timezone to use for all calculations (e.g. "America/New_York").
 */
export class ScheduleFunction extends AutoUpdateFunction {
  private _cache = new WeakMap<object, ScheduleValue>();
  private _events: ScheduleValue[];

  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name.startsWith('config') || input._name === '[]' || input._name === 'timezone') {
      // re-generate events when config changes.
      this._events = null;
    } else if (this._events && input._name.startsWith('value')) {
      const index = parseInt(input._name.substring(5 /* 'value'.length */));
      if (this._events[index]) {
        this._events[index].value = val;
      }
    }
    return true;
  }

  run() {
    // 1. Check for manual override
    const override = this._data.getValue('override');
    const resolveMode = this._data.getValue('resolveMode');
    const mergeMode = resolveMode === 'merge';
    if (override !== undefined && !mergeMode) {
      this._data.output(override);
      return;
    }

    let timezone = this._data.getValue('timezone') as string;

    if (!this._events) {
      const eventsData = getInputsArray(this._data, '', 1, ['config', 'value']) as {config: unknown; value: unknown}[];
      if (typeof timezone !== 'string' || timezone === 'Factory' || timezone === 'auto') {
        timezone = getDefaultZone();
      }
      // generate events
      this._events = [];
      const newCache = new WeakMap<object, ScheduleValue>();
      for (let i = 0; i < eventsData.length; i++) {
        const {config, value} = eventsData[i];
        let sv = this._cache.get(config as object);
        if (!sv) {
          const event = SchedulerEvent.fromProperty(config, timezone);
          if (!event) {
            continue;
          }
          sv = new ScheduleValue(event, value, i);
        } else {
          sv.value = value;
          sv.index = i;
        }
        newCache.set(config as object, sv);
        this._events.push(sv);
      }
      this._cache = newCache;
    }

    // 2. Determine the current reference time (default: now, or locked time)
    let ts = new Date().getTime();
    const lockTime = this._data.getValue('lockTime');
    let lockDt: DateTime;
    if (lockTime != null) {
      const dt = toDateTime(lockTime, timezone);
      if (dt.isValid) {
        lockDt = dt;
        ts = dt.valueOf();
      }
    }

    const candidates: ScheduleValue[] = [];

    // 3. Find all candidate events that are active at the current time ('ts')
    // We iterate through all defined events. If an event is "happening" right now (occur.start <= ts <= occur.end),
    // it goes into the candidate pool.
    // getOccur(ts) automatically handles finding the relevant occurrence for 'ts'.
    for (const sv of this._events) {
      const occur = sv.getOccur(ts);
      if (occur.isValid()) {
        if (occur.start <= ts) {
          candidates.push(sv);
        }
      }
    }
    // Sort candidates to find the "winner" based on priority logic.
    // The last element in the sorted array is the highest priority/winner.
    candidates.sort(ScheduleValue.compare);
    let current = candidates.at(-1);
    let result: any;

    // 4. Resolve the value based on the selected mode (overwrite, merge, min, max)
    switch (resolveMode) {
      case 'merge': {
        result = {};
        function addResult(value: unknown) {
          if (value !== undefined) {
            if (value?.constructor === Object) {
              result = {...result, ...(value as object)};
            } else {
              result = {...result, value};
            }
          }
        }
        addResult(this._data.getValue('default'));
        for (const candidate of candidates) {
          addResult(candidate.value);
        }
        addResult(override);
        break;
      }
      case 'min':
        if (candidates.length) {
          let currentNum = Infinity;
          for (const candidate of candidates) {
            const n = Number(candidate.value);
            if (n <= currentNum) {
              current = candidate;
              currentNum = n;
            }
          }
          result = current.value;
        }
        break;
      case 'max':
        if (candidates.length) {
          let currentNum = -Infinity;
          for (const candidate of candidates) {
            const n = Number(candidate.value);
            if (n >= currentNum) {
              current = candidate;
              currentNum = n;
            }
          }
          result = current.value;
        }
        break;
      default:
        // 'overwrite' mode: only the highest priority event's value is used.
        result = current?.value;
    }

    // 5. Calculate the next wake-up time (nextTs) for the scheduler.
    // The scheduler needs to know the exact time when the output *might* change.
    // This allows the system to sleep efficiently instead of polling.
    // The next change happens when:
    // a) The current event ends.
    // b) A new event starts (that might override or merge with the current one).
    // c) A higher priority event starts.
    if (!lockDt) {
      let nextTs = Infinity;
      switch (resolveMode) {
        case 'merge': {
          // In merge mode, *any* event starting or ending can change the result.
          // So we look for the earliest start > ts (some new data arriving)
          // OR the earliest end < nextTs (some current data leaving).
          for (const sv of this._events) {
            const occur = sv.occur;
            if (occur.isValid() && sv.value !== undefined) {
              if (occur.start > ts) {
                if (occur.start < nextTs) {
                  nextTs = occur.start;
                }
              } else if (occur.end < nextTs) {
                // Occur is currently active (implied by !(start > ts) and it's valid),
                // so its end time is a candidate for next change.
                nextTs = occur.end + 1;
              }
            }
          }
          break;
        }
        case 'min': {
          // In min mode, we only care about events that could produce a *smaller* value than current.
          const currentNum = current?.value ?? Infinity;
          if (current) {
            // If the current winner ends, the value changes (likely goes up).
            nextTs = current.occur.end + 1;
          }
          for (const sv of this._events) {
            // Look for future events that start before our known next-change-time AND
            // have a value smaller than current. Only those can interrupt the current state logic.
            if (sv.occur.isValid() && sv.occur.start > ts && sv.occur.start < nextTs && sv.value < currentNum) {
              nextTs = sv.occur.start;
            }
          }
          break;
        }
        case 'max': {
          // Symmetrical to min mode; only care about larger values interrupting.
          const currentNum = current?.value ?? -Infinity;
          if (current) {
            nextTs = current.occur.end + 1;
          }
          for (const sv of this._events) {
            if (sv.occur.isValid() && sv.occur.start > ts && sv.occur.start < nextTs && sv.value > currentNum) {
              nextTs = sv.occur.start;
            }
          }
          break;
        }
        default: {
          // 'overwrite' mode / default.
          // We need to find the "next" event that would actually replace the "current" winner.
          // This uses 'shouldReplaceNext' to determine if a future event is strong enough or early enough
          // to take over.
          let next: ScheduleValue;
          for (const sv of this._events) {
            const occur = sv.occur;
            if (occur.isValid()) {
              if (occur.start > ts) {
                // Candidate for the next taking-over event.
                if (sv.shouldReplaceNext(current, next)) {
                  next = sv;
                }
              }
            }
          }
          if (next) {
            nextTs = next.occur.start;
          } else if (current) {
            // If no one takes over, the state changes when the current winner ends.
            nextTs = current.occur.end + 1;
          }
        }
      }
      if (nextTs !== Infinity) {
        this.addSchedule(nextTs);
      }
    }
    if (result !== undefined) {
      this._data.output(result);
    } else {
      this._data.output(this._data.getValue('default'));
    }
  }
}

Functions.add(ScheduleFunction, {
  name: 'scheduler',
  icon: 'fas:calendar-days',
  priority: 1,
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 1,
      properties: [
        {name: 'config', type: 'schedule', pinned: true},
        {name: 'value', type: 'any', pinned: true},
      ],
    },
    {name: 'default', type: 'any', pinned: true},
    {name: 'override', type: 'any'},
    {name: 'lockTime', type: 'date'},
    {name: 'resolveMode', type: 'select', options: ['overwrite', 'merge', 'max', 'min'], default: 'overwrite'},
    {name: 'timezone', type: 'string', default: ''},
    {name: '#output', type: 'any', readonly: true, pinned: true},
  ],
  category: 'date',
});
