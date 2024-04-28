import {Functions} from '../../../block/Functions';
import {AutoUpdateFunction} from '../../base/AutoUpdateFunction';
import {type EventOccur, ScheduleEvent} from './ScheduleEvent';
import {BlockIO} from '../../../block/BlockProperty';
import {ValueUpdateEvent} from '../../../block/Event';

export class ScheduleValue {
  occur: EventOccur;
  constructor(
    public readonly event: ScheduleEvent,
    public value: unknown,
    public index: number
  ) {}
  getOccur(ts: number, timezone: string): EventOccur {
    this.occur = this.event.getOccur(ts, timezone);
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
    if (input._name !== 'default') {
      // re-generate events when input changes.
      this.#events = null;
    }
    return true;
  }

  run() {
    const eventsData = this._data.getArray('', 1, ['config', 'value']) as {config: unknown; value: unknown}[];
    if (!this.#events) {
      // generate events
      this.#events = [];
      const newCache = new WeakMap<object, ScheduleValue>();
      for (let i = 0; i < eventsData.length; i++) {
        let {config, value} = eventsData[i];
        let sv = this.#cache.get(config as object);
        if (!sv) {
          let event = ScheduleEvent.fromProperty(config);
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
    let timezone = this._data.getValue('timezone') as string;
    if (typeof timezone !== 'string') {
      timezone = null;
    }
    const occurs: EventOccur[] = [];
    let ts = new Date().getTime();
    let current: ScheduleValue;
    let next: ScheduleValue;
    // check the current
    for (let sv of this.#events) {
      const occur = sv.getOccur(ts, timezone);
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
    if (next) {
      this.addSchedule(next.occur.start);
    } else if (current) {
      this.addSchedule(current.occur.end + 1);
    }

    let outputValue = current ? current.value : this._data.getValue('default');
    this._data.output(outputValue);

    if (current) {
      // TODO make sure event is different from last one
      return new ValueUpdateEvent(current.event.name, current.value, current.occur.start);
    }
  }
}

Functions.add(ScheduleFunction, {
  name: 'schedule',
  icon: 'fas:calendar-days',
  priority: 1,
  properties: [
    {
      name: '',
      type: 'group',
      defaultLen: 0,
      properties: [
        {name: 'config', type: 'object', pinned: true},
        {name: 'value', type: 'any', pinned: true},
      ],
    },
    {name: 'default', type: 'any', pinned: true},
    {name: 'override', type: 'any'},
    {name: 'timezone', type: 'string', default: ''},
    {name: '#output', type: 'any', readonly: true, pinned: true},
  ],
  category: 'date',
});
