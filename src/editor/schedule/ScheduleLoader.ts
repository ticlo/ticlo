import {Event} from 'react-big-calendar';
import {ClientConn, ValueSubscriber} from '../../core/connect/ClientConn';
import {ValueUpdate} from '../../core/connect/ClientRequests';
import {EventOccur, ScheduleEvent, validateEventConfig} from '../../core/functions/date/Schedule/ScheduleEvent';
import {cacheCall} from '../util/CachedCallback';
import * as React from 'react';
import {deepEqual} from '../../core/util/Compare';

export class CalendarEvent implements Event {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
    public readonly title: React.ReactNode,
    public readonly parent: ConfigValuePair
  ) {}
}

class ConfigValuePair {
  configSub = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const event = ScheduleEvent.fromProperty(response.cache.value);
      if (event) {
        this.event = event;
        this.parent.parent.forceUpdate();
      }
    },
  });
  valueSub = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (!deepEqual(response.cache.value, this.value)) {
        this.value = response.cache.value;
        this.parent.parent.forceUpdate();
      }
    },
  });
  constructor(
    public readonly idx: number,
    public readonly parent: ScheduleLoader
  ) {
    this.configSub.subscribe(parent.conn, `${parent.schedulePath}.config${idx}`, true);
    this.configSub.subscribe(parent.conn, `${parent.schedulePath}.value${idx}`);
  }
  event: ScheduleEvent;
  value: unknown;

  #getCachedEvents = cacheCall(
    ([start, end, event, value]: [number, number, ScheduleEvent, unknown]) => {
      event.clearCache();
      const result: CalendarEvent[] = [];
      let next = start;
      while (next <= end) {
        let o = event.getOccur(next);
        if (o.isValid()) {
          result.push(new CalendarEvent(new Date(o.start), new Date(o.end), event.name, this));
          next = o.end + 1;
        } else {
          break;
        }
      }
      return result;
    },
    null,
    []
  );

  getEvents(start: number, end: number): CalendarEvent[] {
    return this.#getCachedEvents([start, end, this.event, this.value]);
  }

  destroy() {
    this.configSub.unsubscribe();
    this.valueSub.unsubscribe();
  }
}

export class ScheduleLoader {
  eventsLenSub = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.updateEventLength(response.cache.value);
    },
  });
  constructor(
    public readonly parent: {forceUpdate: Function},
    public readonly conn: ClientConn,
    public readonly schedulePath: string
  ) {
    this.eventsLenSub.subscribe(conn, `${schedulePath}.[]`, true);
  }
  subs: ConfigValuePair[] = [];

  updateEventLength(v: unknown) {
    let len = 1;
    if (Number.isInteger(v) && (v as number) > 1) {
      len = v as number;
    }
    if (len < this.subs.length) {
      for (let i = len; i < this.subs.length; i++) {
        this.subs[i].destroy();
      }
      this.subs.length = len;
    } else {
      while (len > this.subs.length) {
        this.subs.push(new ConfigValuePair(this.subs.length, this));
      }
    }
  }
  getEvents(start: number, end: number) {
    const result: CalendarEvent[] = [];
    for (let pair of this.subs) {
      result.push(...pair.getEvents(start, end));
    }
    return result;
  }
  destroy(): void {
    this.eventsLenSub.unsubscribe();
    for (let sub of this.subs) {
      sub.destroy();
    }
  }
}
