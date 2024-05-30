import {Functions} from '../../../block/Functions';
import {AutoUpdateFunction} from '../../base/AutoUpdateFunction';
import {type EventOccur, SchedulerEvent} from './SchedulerEvent';
import {BlockIO} from '../../../block/BlockProperty';
import {systemZone, toDateTime} from '../../../util/DateTime';
import {DateTime} from 'luxon';

export class ScheduleValue {
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
      // we only care about the earliest event that happens next
      return this.occur.start < next.occur.start;
    }
    return true;
  }
}

export class ScheduleFunction extends AutoUpdateFunction {
  #cache = new WeakMap<object, ScheduleValue>();
  #events: ScheduleValue[];

  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name.startsWith('config') || input._name === '[]' || input._name === 'timezone') {
      // re-generate events when config changes.
      this.#events = null;
    } else if (input._name === 'lockTime') {
      if (this.#events) {
        for (let event of this.#events) {
          event.event.clearCache();
        }
      }
    } else if (this.#events && input._name.startsWith('value')) {
      let index = parseInt(input._name.substring(5 /* 'value'.length */));
      if (this.#events[index]) {
        this.#events[index].value = val;
      }
    }
    return true;
  }

  run() {
    const override = this._data.getValue('override');
    const resolveMode = this._data.getValue('resolveMode');
    const mergeMode = resolveMode === 'merge';
    if (override !== undefined && !mergeMode) {
      this._data.output(override);
      return;
    }

    let timezone = this._data.getValue('timezone') as string;

    if (!this.#events) {
      const eventsData = this._data.getArray('', 1, ['config', 'value']) as {config: unknown; value: unknown}[];
      if (typeof timezone !== 'string' || timezone === 'Factory' || timezone === '?') {
        timezone = systemZone;
      }
      // generate events
      this.#events = [];
      const newCache = new WeakMap<object, ScheduleValue>();
      for (let i = 0; i < eventsData.length; i++) {
        let {config, value} = eventsData[i];
        let sv = this.#cache.get(config as object);
        if (!sv) {
          let event = SchedulerEvent.fromProperty(config, timezone);
          if (!event) {
            continue;
          }
          sv = new ScheduleValue(event, value, i);
        } else {
          sv.value = value;
          sv.index = i;
        }
        newCache.set(config as object, sv);
        this.#events.push(sv);
      }
      this.#cache = newCache;
    }
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

    let candidates: ScheduleValue[] = [];

    // check the current
    for (let sv of this.#events) {
      const occur = sv.getOccur(ts);
      if (occur.isValid()) {
        if (occur.start <= ts) {
          candidates.push(sv);
        }
      }
    }
    candidates.sort(ScheduleValue.compare);
    let current = candidates.at(-1);
    let result: any;
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
        for (let candidate of candidates) {
          addResult(candidate.value);
        }
        addResult(override);
        break;
      }
      case 'min':
        if (candidates.length) {
          let currentNum = Infinity;
          for (let candidate of candidates) {
            let n = Number(candidate.value);
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
          for (let candidate of candidates) {
            let n = Number(candidate.value);
            if (n >= currentNum) {
              current = candidate;
              currentNum = n;
            }
          }
          result = current.value;
        }
        break;
      default:
        result = current?.value;
    }

    if (!lockDt) {
      let nextTs = Infinity;
      switch (resolveMode) {
        case 'merge': {
          for (let sv of this.#events) {
            const occur = sv.occur;
            if (occur.isValid() && sv.value !== undefined) {
              if (occur.start > ts) {
                if (occur.start < nextTs) {
                  nextTs = occur.start;
                }
              } else if (occur.end < nextTs) {
                nextTs = occur.end + 1;
              }
            }
          }
          break;
        }
        case 'min': {
          const currentNum = current?.value ?? Infinity;
          if (current) {
            nextTs = current.occur.end + 1;
          }
          for (let sv of this.#events) {
            if (sv.occur.isValid() && sv.occur.start > ts && sv.occur.start < nextTs && sv.value < currentNum) {
              nextTs = sv.occur.start;
            }
          }
          break;
        }
        case 'max': {
          const currentNum = current?.value ?? -Infinity;
          if (current) {
            nextTs = current.occur.end + 1;
          }
          for (let sv of this.#events) {
            if (sv.occur.isValid() && sv.occur.start > ts && sv.occur.start < nextTs && sv.value > currentNum) {
              nextTs = sv.occur.start;
            }
          }
          break;
        }
        default: {
          let next: ScheduleValue;
          for (let sv of this.#events) {
            const occur = sv.occur;
            if (occur.isValid()) {
              if (occur.start > ts) {
                if (sv.shouldReplaceNext(current, next)) {
                  next = sv;
                }
              }
            }
          }
          if (next) {
            nextTs = next.occur.start;
          } else if (current) {
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
