import React, {CSSProperties} from 'react';
import {Event} from 'ticlo-big-calendar';
import {ClientConn, ValueSubscriber} from '../../core/connect/ClientConn';
import {ValueUpdate} from '../../core/connect/ClientRequests';
import {
  EventOccur,
  SchedulerConfig,
  SchedulerEvent,
  validateEventConfig,
} from '../../core/functions/date/Schedule/SchedulerEvent';
import {cacheCall} from '../util/CachedCallback';
import {deepEqual} from '../../core/util/Compare';
import {encodeDisplay} from '../../core';

const priorityStr = '⓿❶❷❸❹❺❻❼❽❾❿';

function getTitle(config: SchedulerConfig, value: unknown) {
  const parts: string[] = [];
  if (config?.name) {
    parts.push(config.name);
  }
  parts.push(encodeDisplay(value));
  return parts.join('\n');
}

export class CalendarEvent implements Event {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
  allDay?: boolean;
  icon?: React.ReactNode;
  constructor(
    start: number,
    end: number,
    public readonly title: React.ReactNode,
    public readonly parent: ConfigValuePair
  ) {
    this.start = new Date(start);
    this.end = new Date(end);
    this.id = `${parent.idx}-${this.start.getMonth()}-${this.start.getDate()}`;
    if (
      this.start.getHours() === 0 &&
      this.start.getMinutes() === 0 &&
      this.end.getHours() === 23 &&
      this.end.getMinutes() === 59
    ) {
      this.allDay = true;
    }
    const priority = parent?.event?.priority;
    if (Number.isFinite(priority)) {
      const n = Math.round(priority);
      if (n >= 0 && n <= 10) {
        this.icon = <span>{priorityStr.charAt(n)}</span>;
      } else {
        this.icon = <span>({n})</span>;
      }
    }
  }
}

class ConfigValuePair {
  configSub = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (this.config !== response.cache.value) {
        this.config = response.cache.value;
        if (typeof this.config !== 'object' || Array.isArray(this.config)) {
          this.config = null;
        }
        const event = SchedulerEvent.fromProperty(this.config);
        if (event) {
          this.event = event;
          this.buildStyle();
        } else {
          this.event = null;
          this.buildStyle();
        }
        this.parent.parent.forceUpdate();
      }
    },
  });
  valueSub = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (!deepEqual(response.cache.value, this.value)) {
        this.value = response.cache.value;
        this.buildStyle();
        this.parent.parent.forceUpdate();
      }
    },
  });
  constructor(
    public readonly idx: number,
    public readonly parent: ScheduleLoader
  ) {
    this.configSub.subscribe(parent.conn, `${parent.schedulePath}.config${idx}`, true);
    this.valueSub.subscribe(parent.conn, `${parent.schedulePath}.value${idx}`);
  }
  config: SchedulerConfig;
  event: SchedulerEvent;
  value: unknown;
  style?: CSSProperties = {borderLeftStyle: 'dotted'};
  visible = true;
  toggleVisible() {
    this.visible = !this.visible;
    this.parent.parent.forceUpdate();
  }
  buildStyle() {
    const style: CSSProperties = {};
    if (this.config?.color) {
      style.borderLeftColor = this.config.color;
    }
    if (!Boolean(this.value)) {
      style.borderLeftStyle = 'dotted';
    }
    this.style = style;
  }

  #getCachedEvents = cacheCall(
    ([start, end, event, value]: [number, number, SchedulerEvent, unknown]) => {
      const result: CalendarEvent[] = [];
      if (event) {
        event.clearCache();
        let next = start;
        while (next <= end) {
          let o = event.getOccur(next);
          if (o.isValid()) {
            // event will change everytime config changes, so the cache is valid.
            result.push(new CalendarEvent(o.start, o.end, getTitle(this.config, value), this));
            next = o.end + 1;
          } else {
            break;
          }
        }
      }
      return result;
    },
    null,
    []
  );

  getEvents(start: number, end: number): CalendarEvent[] {
    if (this.visible) {
      return this.#getCachedEvents([start, end, this.event, this.value]);
    }
    return [];
  }

  #getDummyEvent = cacheCall(([event, value]: [config: SchedulerEvent, unknown]) => {
    // event will change everytime config changes, so the cache is valid.
    return new CalendarEvent(1, 2, getTitle(this.config, value), this);
  });
  getDummyEvent(): CalendarEvent {
    return this.#getDummyEvent([this.event, this.value]);
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
    if (len !== this.subs.length) {
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
      this.parent.forceUpdate();
    }
  }
  getEvents(start: number, end: number) {
    const result: CalendarEvent[] = [];
    for (let pair of this.subs) {
      result.push(...pair.getEvents(start, end));
    }
    return result;
  }
  getDummyEvents() {
    const result: CalendarEvent[] = [];
    for (let pair of this.subs) {
      result.push(pair.getDummyEvent());
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
