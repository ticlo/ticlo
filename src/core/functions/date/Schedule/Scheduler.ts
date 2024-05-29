import {Functions} from '../../../block/Functions';
import {AutoUpdateFunction} from '../../base/AutoUpdateFunction';
import {type EventOccur, SchedulerEvent} from './SchedulerEvent';
import {BlockIO} from '../../../block/BlockProperty';
import {ValueUpdateEvent} from '../../../block/Event';
import {systemZone, toDateTime} from '../../../util/DateTime';
import {DateTime} from 'luxon';

export class ScheduleValue {
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
    const mergeMode = this._data.getValue('resolveMode') === 'merge';
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

    if (mergeMode) {
    } else {
      const occurs: EventOccur[] = [];

      let current: ScheduleValue;
      let next: ScheduleValue;
      // check the current
      for (let sv of this.#events) {
        const occur = sv.getOccur(ts);
        if (occur.isValid()) {
          if (occur.start <= ts) {
            if (sv.shouldReplace(current)) {
              current = sv;
            }
          }
        }
      }
      // check the next
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
      if (!lockDt) {
        if (next) {
          this.addSchedule(next.occur.start);
        } else if (current) {
          this.addSchedule(current.occur.end + 1);
        }
      }

      let outputValue = current ? current.value : this._data.getValue('default');
      this._data.output(outputValue);

      if (current) {
        // TODO make sure event is different from last one
        return new ValueUpdateEvent(current.event.name, current.value, current.occur.start);
      }
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
